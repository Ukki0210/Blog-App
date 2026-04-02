using Dapper;
using LifestyleBlog.DTOs;
using LifestyleBlog.Models;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace LifestyleBlog.Services;

public class UserService(DatabaseService db)
{
    public async Task<Profile?> GetProfileAsync(Guid id)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Profile>(
            "SELECT * FROM profiles WHERE id = @Id", new { Id = id });
    }

    public async Task<Profile> UpsertProfileAsync(Guid id, string email, UpdateProfileDto? dto = null)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            INSERT INTO profiles (id, email) VALUES (@Id, @Email)
            ON CONFLICT (id) DO UPDATE SET email = @Email, updated_at = NOW()",
            new { Id = id, Email = email });

        if (dto != null)
        {
            await conn.ExecuteAsync(@"
                UPDATE profiles SET
                    username = COALESCE(@Username, username),
                    full_name = COALESCE(@FullName, full_name),
                    avatar_url = COALESCE(@AvatarUrl, avatar_url),
                    bio = COALESCE(@Bio, bio),
                    website = COALESCE(@Website, website),
                    twitter = COALESCE(@Twitter, twitter),
                    instagram = COALESCE(@Instagram, instagram),
                    updated_at = NOW()
                WHERE id = @Id",
                new
                {
                    Id = id,
                    dto.Username,
                    dto.FullName,
                    dto.AvatarUrl,
                    dto.Bio,
                    dto.Website,
                    dto.Twitter,
                    dto.Instagram
                });
        }

        return (await GetProfileAsync(id))!;
    }

    public async Task<List<Profile>> GetAllUsersAsync()
    {
        using var conn = db.CreateConnection();
        return (await conn.QueryAsync<Profile>(
            "SELECT * FROM profiles ORDER BY created_at DESC")).ToList();
    }

    public async Task UpdateUserRoleAsync(Guid id, string role)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "UPDATE profiles SET role = @Role WHERE id = @Id",
            new { Id = id, Role = role });
    }

    public async Task SubscribeNewsletterAsync(string email)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(
            "INSERT INTO newsletter_subscribers (email) VALUES (@Email) ON CONFLICT DO NOTHING",
            new { Email = email });
    }
}

public class ChatbotService(HttpClient httpClient, IConfiguration config, DatabaseService db)
{
    private readonly string _apiKey = config["Groq:ApiKey"]!;
    private readonly string _model = config["Groq:Model"] ?? "llama-3.3-70b-versatile";

    public async IAsyncEnumerable<string> StreamResponseAsync(
        ChatRequestDto request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // Save user message and load history — all DB work before any yield
        List<dynamic> history;
        using (var conn = db.CreateConnection())
        {
            await conn.ExecuteAsync(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (@SessionId, 'user', @Content)",
                new { request.SessionId, Content = request.Message });

            history = (await conn.QueryAsync<dynamic>(
                @"SELECT role, content FROM chat_messages
                  WHERE session_id = @SessionId
                  ORDER BY created_at DESC LIMIT 20",
                new { request.SessionId })).Reverse().ToList();
        }

        // Build messages array with system prompt first
        var messages = new List<object>
        {
            new {
                role = "system",
                content = "You are a friendly and knowledgeable assistant for Lifestyle — a curated living blog covering culture, food, home, style, travel, and wellness. Help users discover articles, answer questions, and provide thoughtful lifestyle advice. Keep responses warm, concise, and inspiring. Use markdown formatting when helpful."
            }
        };

        messages.AddRange(history.Select(h => (object)new
        {
            role = (string)h.role,
            content = (string)h.content
        }));

        var payload = new
        {
            model = _model,
            messages,
            stream = true,
            max_tokens = 1024,
            temperature = 0.7
        };

        var serialized = JsonSerializer.Serialize(payload);

        // Build HTTP request to Groq
        var httpRequest = new HttpRequestMessage(HttpMethod.Post,
            "https://api.groq.com/openai/v1/chat/completions");
        httpRequest.Headers.Add("Authorization", $"Bearer {_apiKey}");
        httpRequest.Content = new StringContent(serialized, Encoding.UTF8, "application/json");

        // Send — no try/catch around the await so we can yield after
        var response = await httpClient.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync(cancellationToken);
            yield return $"Groq API error ({response.StatusCode}): {err}";
            yield break;
        }

        var fullResponse = new StringBuilder();
        using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        // Stream SSE lines from Groq
        while (!reader.EndOfStream && !cancellationToken.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (string.IsNullOrEmpty(line)) continue;
            if (!line.StartsWith("data: ")) continue;

            var data = line["data: ".Length..].Trim();
            if (data == "[DONE]") break;
            if (!data.StartsWith("{")) continue;

            string? text = null;
            var json = JsonSerializer.Deserialize<JsonElement>(data);
            if (json.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("delta", out var delta) &&
                delta.TryGetProperty("content", out var content))
            {
                text = content.GetString();
            }

            if (!string.IsNullOrEmpty(text))
            {
                fullResponse.Append(text);
                yield return text;
            }
        }

        // Save full assistant response to DB after streaming completes
        using var finalConn = db.CreateConnection();
        await finalConn.ExecuteAsync(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (@SessionId, 'assistant', @Content)",
            new { request.SessionId, Content = fullResponse.ToString() });
    }
}