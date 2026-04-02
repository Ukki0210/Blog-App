using System.Text;
using System.Text.Json;

namespace LifestyleBlog.Services;

/// <summary>
/// AI Writing Assistant — given a blog title, streams back structured SSE events:
///   { field: "excerpt",     value: "..." }
///   { field: "category",    value: "travel" }
///   { field: "tags",        value: "coorg, travel, karnataka" }
///   { field: "coverImage",  value: "https://..." }
///   { field: "contentToken",value: "<p>Some " }   ← many of these, one per LLM token
///   { field: "contentToken",value: "words..." }
/// The frontend assembles the content tokens into the editor in real time.
/// </summary>
public class AiWriteService(IConfiguration config, HttpClient http, ILogger<AiWriteService> logger)
{
    private readonly string _groqApiKey = config["Groq:ApiKey"]!;
    private readonly string _groqModel  = config["Groq:Model"] ?? "llama-3.3-70b-versatile";

    /// <summary>Main entry point — yields SSE event objects to the controller.</summary>
    public async IAsyncEnumerable<object> GeneratePostAsync(string title, string? instructions)
    {
        // ── STEP 1: Metadata (non-streaming, fast JSON response) ──────────────
        var metaJson = await GetMetadataAsync(title, instructions);
        if (metaJson == null)
        {
            yield return new { field = "error", value = "Could not reach AI. Check your Groq API key and internet connection." };
            yield break;
        }

        // Parse metadata outside try/catch so we can safely yield after.
        // C# CS1626: cannot yield inside a try block that has a catch clause.
        var metaEvents = ParseMetadata(metaJson, title);
        foreach (var evt in metaEvents)
            yield return evt;

        // ── STEP 2: Stream the article content token by token ─────────────────
        yield return new { field = "contentStart", value = "" };

        var streamError = await OpenContentStreamAsync(title, instructions);
        if (streamError != null)
        {
            yield return new { field = "error", value = streamError };
            yield break;
        }

        // Drain the stream — yield each token as a contentToken event
        await using var stream = _contentStream!;
        using var reader = new StreamReader(stream);
        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync();
            if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data: ")) continue;
            var json = line[6..].Trim();
            if (json == "[DONE]") break;
            string? token = null;
            try
            {
                using var doc = JsonDocument.Parse(json);
                token = doc.RootElement.GetProperty("choices")[0].GetProperty("delta")
                    .TryGetProperty("content", out var c) ? c.GetString() : null;
            }
            catch { /* malformed chunk */ }
            if (token != null)
                yield return new { field = "contentToken", value = token };
        }

        yield return new { field = "contentEnd", value = "" };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string?> GetMetadataAsync(string title, string? instructions)
    {
        var prompt = $@"You are an expert lifestyle blog writer. Given the blog post title below, return ONLY a valid JSON object (no markdown fences, no explanation) with these exact keys:
{{
  ""excerpt"": ""A compelling 1-2 sentence article summary (max 180 characters)"",
  ""category"": ""exactly one of: culture, food, home, style, travel, wellness"",
  ""tags"": ""3-5 relevant comma-separated lowercase tags"",
  ""coverQuery"": ""4-6 words for an Unsplash image search (e.g. 'lush green coorg coffee plantation')""
}}

Title: {title}
{(string.IsNullOrEmpty(instructions) ? "" : $"Writer notes: {instructions}")}";

        var payload = JsonSerializer.Serialize(new
        {
            model       = _groqModel,
            messages    = new[] { new { role = "user", content = prompt } },
            max_tokens  = 350,
            temperature = 0.6
        });

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _groqApiKey);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        try
        {
            var res  = await http.SendAsync(req);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode)
            {
                logger.LogError("[AIWrite] Metadata error {Status}: {Body}", res.StatusCode, body[..Math.Min(300, body.Length)]);
                return null;
            }
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AIWrite] Metadata request failed");
            return null;
        }
    }

    private Stream? _contentStream;

    private async Task<string?> OpenContentStreamAsync(string title, string? instructions)
    {
        var prompt = $@"You are an expert lifestyle blog writer for a curated living magazine. Write a complete, engaging blog article.

Requirements:
- Warm, knowledgeable, first-person lifestyle magazine voice
- 500-700 words total
- Start directly with the content — no title, no preamble
- Structure: 1 intro paragraph, then 3-4 sections each with an <h2> heading, then a brief closing paragraph
- Use ONLY these HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>
- No markdown, no code blocks, no triple backticks
- Make it genuinely informative, specific, and memorable

Title: {title}
{(string.IsNullOrEmpty(instructions) ? "" : $"Writer notes: {instructions}")}";

        var payload = JsonSerializer.Serialize(new
        {
            model       = _groqModel,
            messages    = new[] { new { role = "user", content = prompt } },
            max_tokens  = 2048,
            temperature = 0.75,
            stream      = true
        });

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _groqApiKey);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        try
        {
            var res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
            if (!res.IsSuccessStatusCode)
            {
                var err = await res.Content.ReadAsStringAsync();
                logger.LogError("[AIWrite] Content stream error {Status}: {Body}", res.StatusCode, err[..Math.Min(300, err.Length)]);
                return $"AI content error ({(int)res.StatusCode}). Please try again.";
            }
            _contentStream = await res.Content.ReadAsStreamAsync();
            return null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[AIWrite] Content stream request failed");
            return "Connection error. Please try again.";
        }
    }
    /// <summary>
    /// Parses the Groq metadata JSON outside of any iterator try/catch block
    /// (C# CS1626 forbids yield inside try-with-catch).
    /// Returns a list of SSE event objects ready to be yielded by the caller.
    /// </summary>
    private List<object> ParseMetadata(string metaJson, string title)
    {
        var events = new List<object>();
        try
        {
            var clean = metaJson.Trim().TrimStart('`');
            if (clean.StartsWith("json", StringComparison.OrdinalIgnoreCase)) clean = clean[4..];
            clean = clean.Trim().TrimEnd('`').Trim();

            using var doc = JsonDocument.Parse(clean);
            var root = doc.RootElement;

            if (root.TryGetProperty("excerpt", out var e))
                events.Add(new { field = "excerpt", value = e.GetString() ?? "" });

            if (root.TryGetProperty("category", out var cat))
                events.Add(new { field = "category", value = cat.GetString() ?? "" });

            if (root.TryGetProperty("tags", out var t))
                events.Add(new { field = "tags", value = t.GetString() ?? "" });

            if (root.TryGetProperty("coverQuery", out var q))
            {
                var coverQuery = q.GetString() ?? title;
                var encoded    = Uri.EscapeDataString(coverQuery);
                events.Add(new { field = "coverImage", value = $"https://source.unsplash.com/1600x900/?{encoded}" });
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning("[AIWrite] Metadata parse error: {Msg} | Raw: {Raw}", ex.Message,
                metaJson[..Math.Min(300, metaJson.Length)]);
        }
        return events;
    }

}