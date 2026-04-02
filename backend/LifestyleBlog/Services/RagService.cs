using Dapper;
using System.Text;
using System.Text.Json;

namespace LifestyleBlog.Services;

/// <summary>
/// RAG Service — Retrieval-Augmented Generation
///
/// Pipeline:
///   INGESTION  → chunk blog content → store plain text in post_chunks (no vectors needed)
///   RETRIEVAL  → BM25-style keyword scoring against stored chunks (no embedding API needed)
///   GENERATION → top chunks + question sent to Groq LLM → streamed answer
///
/// Why no embeddings? The free Groq tier does not include nomic-embed-text-v1.5,
/// and external embedding APIs add latency and cost. For a blog with dozens to hundreds
/// of posts, BM25 keyword retrieval is fast, free, and surprisingly effective.
/// You can upgrade to vector search later by adding pgvector + an embedding provider.
/// </summary>
public class RagService(
    DatabaseService db,
    IConfiguration config,
    HttpClient http,
    ILogger<RagService> logger)
{
    private readonly string _groqApiKey = config["Groq:ApiKey"]!;
    private readonly string _groqModel  = config["Groq:Model"] ?? "llama-3.3-70b-versatile";
    private const int ChunkSize    = 300;  // words per chunk
    private const int ChunkOverlap = 60;   // word overlap between chunks
    private const int TopK         = 5;    // chunks to pass to LLM

    // ── INGESTION ─────────────────────────────────────────────────────────────

    /// <summary>Called on post create/update. Stores plain-text chunks (no embeddings).</summary>
    public async Task IngestPostAsync(Guid postId, string title, string content)
    {
        try
        {
            var fullText = title + "\n\n" + content;
            var chunks   = ChunkText(fullText);
            logger.LogInformation("[RAG] Ingesting post {PostId} — {Count} chunks", postId, chunks.Count);

            using var conn = db.CreateConnection();
            await conn.ExecuteAsync("DELETE FROM post_chunks WHERE post_id = @PostId", new { PostId = postId });

            for (var i = 0; i < chunks.Count; i++)
            {
                await conn.ExecuteAsync(@"
                    INSERT INTO post_chunks (post_id, chunk_index, chunk_text)
                    VALUES (@PostId, @ChunkIndex, @ChunkText)",
                    new { PostId = postId, ChunkIndex = i, ChunkText = chunks[i] });
            }

            logger.LogInformation("[RAG] Ingestion complete for post {PostId} ({Count} chunks)", postId, chunks.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[RAG] Ingestion failed for post {PostId}", postId);
        }
    }

    // ── RETRIEVAL + GENERATION ────────────────────────────────────────────────

    /// <summary>
    /// Retrieves the most relevant chunks using BM25 keyword scoring,
    /// then streams an LLM-generated answer from Groq.
    /// </summary>
    public async IAsyncEnumerable<string> AskAsync(string question, Guid? postId = null)
    {
        // 1. Pull chunks from DB (scoped to post, or all published posts)
        var allChunks = await FetchChunksAsync(postId);

        if (allChunks.Count == 0)
        {
            logger.LogWarning("[RAG] No chunks found for postId={PostId} — post may not have been ingested yet", postId);
            yield return "This article hasn't been indexed yet. Please ask an admin to re-ingest it, or try again in a moment.";
            yield break;
        }

        // 2. Score chunks with BM25 keyword relevance
        var topChunks = BM25Score(question, allChunks, TopK);

        if (topChunks.Count == 0)
        {
            yield return "I couldn't find relevant content for your question. Try rephrasing it.";
            yield break;
        }

        logger.LogInformation("[RAG] Retrieved {Count} chunks for question: {Q}", topChunks.Count, question[..Math.Min(60, question.Length)]);

        // 3. Build context and stream Groq answer
        var context = string.Join("\n\n---\n\n", topChunks.Select((c, i) => $"[Excerpt {i + 1}]\n{c}"));

        var systemPrompt = postId.HasValue
            ? "You are a helpful assistant for a specific blog article. Answer the user's question using ONLY the provided article excerpts below. Be concise and accurate. If the excerpts don't contain the answer, say so clearly."
            : "You are a helpful assistant for a lifestyle blog. Answer the user's question using ONLY the provided blog excerpts below. Be concise, friendly, and accurate.";

        var messages = new object[]
        {
            new { role = "system", content = systemPrompt },
            new { role = "user",   content = $"Article excerpts:\n\n{context}\n\n---\n\nQuestion: {question}" }
        };

        await foreach (var token in StreamGroqAsync(messages))
            yield return token;
    }

    // ── BM25 KEYWORD SCORING ──────────────────────────────────────────────────

    /// <summary>
    /// Lightweight BM25 implementation. Scores each chunk by term frequency
    /// weighted by inverse document frequency. Works great for Q&A on a small corpus.
    /// </summary>
    private static List<string> BM25Score(string query, List<string> chunks, int topK)
    {
        const double k1 = 1.5;
        const double b  = 0.75;

        var queryTerms   = Tokenise(query);
        if (queryTerms.Count == 0) return chunks.Take(topK).ToList();

        var tokenisedChunks = chunks.Select(Tokenise).ToList();
        var avgLen           = tokenisedChunks.Average(c => (double)c.Count);
        var docCount         = chunks.Count;

        // IDF per query term
        var idf = queryTerms.ToDictionary(term => term, term =>
        {
            var docsWithTerm = tokenisedChunks.Count(c => c.Contains(term));
            return docsWithTerm == 0
                ? 0
                : Math.Log((docCount - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
        });

        // Score each chunk
        var scored = chunks.Select((chunk, idx) =>
        {
            var tokens = tokenisedChunks[idx];
            var docLen = tokens.Count;
            var score  = queryTerms.Sum(term =>
            {
                var tf = tokens.Count(t => t == term);
                return idf[term] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgLen));
            });
            return (chunk, score);
        });

        return scored
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .Take(topK)
            .Select(x => x.chunk)
            .ToList();
    }

    private static HashSet<string> Tokenise(string text) =>
        new(text.ToLowerInvariant()
            .Split(new[] { ' ', '\n', '\r', '\t', '.', ',', '!', '?', ';', ':', '"', '\'', '(', ')' },
                StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 2)   // drop very short words
            .Select(w => w.Trim()));

    // ── DB HELPERS ────────────────────────────────────────────────────────────

    private async Task<List<string>> FetchChunksAsync(Guid? postId)
    {
        using var conn = db.CreateConnection();

        if (postId.HasValue)
        {
            var rows = await conn.QueryAsync<string>(
                "SELECT chunk_text FROM post_chunks WHERE post_id = @PostId ORDER BY chunk_index",
                new { PostId = postId });
            return rows.ToList();
        }

        var allRows = await conn.QueryAsync<string>(@"
            SELECT pc.chunk_text
            FROM post_chunks pc
            JOIN posts p ON p.id = pc.post_id
            WHERE p.status = 'published'
            ORDER BY pc.post_id, pc.chunk_index");
        return allRows.ToList();
    }

    // ── TEXT CHUNKING ─────────────────────────────────────────────────────────

    private static List<string> ChunkText(string text)
    {
        var words  = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var chunks = new List<string>();
        var start  = 0;

        while (start < words.Length)
        {
            var end   = Math.Min(start + ChunkSize, words.Length);
            chunks.Add(string.Join(' ', words[start..end]));
            start += ChunkSize - ChunkOverlap;
            if (start >= words.Length) break;
        }

        return chunks;
    }

    // ── GROQ STREAMING ───────────────────────────────────────────────────────

    private async IAsyncEnumerable<string> StreamGroqAsync(object messages)
    {
        var errorMessage = await SendGroqRequestAsync(messages);
        if (errorMessage != null)
        {
            yield return errorMessage;
            yield break;
        }

        await using var stream = _groqStream!;
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
                token = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("delta")
                    .TryGetProperty("content", out var c) ? c.GetString() : null;
            }
            catch { /* malformed SSE chunk — skip */ }

            if (token != null)
                yield return token;
        }
    }

    private Stream? _groqStream;

    private async Task<string?> SendGroqRequestAsync(object messages)
    {
        var payload = JsonSerializer.Serialize(new
        {
            model       = _groqModel,
            messages,
            stream      = true,
            max_tokens  = 1024,
            temperature = 0.3
        });

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _groqApiKey);
        req.Content = new StringContent(payload, Encoding.UTF8, "application/json");

        HttpResponseMessage res;
        try
        {
            res = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[RAG] Groq chat request failed");
            return "Error connecting to AI service. Check your internet connection.";
        }

        if (!res.IsSuccessStatusCode)
        {
            var err = await res.Content.ReadAsStringAsync();
            logger.LogError("[RAG] Groq error {Status}: {Body}", res.StatusCode, err[..Math.Min(300, err.Length)]);
            return $"AI service error ({(int)res.StatusCode}). Please try again.";
        }

        _groqStream = await res.Content.ReadAsStreamAsync();
        return null;
    }
}