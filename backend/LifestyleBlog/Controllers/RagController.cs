using Microsoft.AspNetCore.Mvc;
using LifestyleBlog.DTOs;
using LifestyleBlog.Services;
using System.Text;
using System.Text.Json;

namespace LifestyleBlog.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RagController(RagService ragService) : ControllerBase
{
    /// <summary>
    /// POST /api/rag/ask
    /// Body: { "question": "...", "postId": "optional-guid" }
    ///
    /// Streams the AI answer back as Server-Sent Events (SSE).
    /// Each event looks like:  data: {"token":"some text"}\n\n
    /// Final event:             data: [DONE]\n\n
    /// </summary>
    [HttpPost("ask")]
    public async Task Ask([FromBody] RagAskDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Question))
        {
            Response.StatusCode = 400;
            return;
        }

        // Set SSE headers
        Response.Headers["Content-Type"]      = "text/event-stream";
        Response.Headers["Cache-Control"]     = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";   // disable nginx buffering
        Response.Headers["Connection"]        = "keep-alive";

        await Response.Body.FlushAsync();

        try
        {
            await foreach (var token in ragService.AskAsync(dto.Question, dto.PostId))
            {
                var payload = "data: " + JsonSerializer.Serialize(new { token }) + "\n\n";
                await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(payload));
                await Response.Body.FlushAsync();
            }

            // Signal completion
            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes("data: [DONE]\n\n"));
            await Response.Body.FlushAsync();
        }
        catch (Exception ex)
        {
            var errPayload = "data: " + JsonSerializer.Serialize(new { token = "\n\n[Error: " + ex.Message + "]" }) + "\n\n";
            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(errPayload));
            await Response.Body.FlushAsync();
        }
    }

    /// <summary>
    /// POST /api/rag/ingest/{postId}
    /// Manually trigger re-ingestion for a specific post (admin/editor use).
    /// </summary>
    [HttpPost("ingest/{postId:guid}")]
    public async Task<IActionResult> Ingest(Guid postId, [FromServices] PostService postService)
    {
        var post = await postService.GetPostByIdAsync(postId, null);
        if (post == null) return NotFound();

        await ragService.IngestPostAsync(postId, post.Title, post.Content);
        return Ok(new { message = "Ingestion triggered", postId });
    }
}