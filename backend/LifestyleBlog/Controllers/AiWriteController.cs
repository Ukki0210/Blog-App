using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LifestyleBlog.Services;
using System.Text;
using System.Text.Json;

namespace LifestyleBlog.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AiWriteController(AiWriteService aiWriteService) : ControllerBase
{
    /// <summary>
    /// POST /api/aiwrite/generate
    /// Body: { "title": "...", "instructions": "optional extra hints" }
    /// Streams SSE with JSON fields filled in one by one.
    /// </summary>
    [Authorize]
    [HttpPost("generate")]
    public async Task Generate([FromBody] AiWriteRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
        {
            Response.StatusCode = 400;
            return;
        }

        Response.Headers["Content-Type"]      = "text/event-stream";
        Response.Headers["Cache-Control"]     = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";
        await Response.Body.FlushAsync();

        try
        {
            await foreach (var evt in aiWriteService.GeneratePostAsync(dto.Title, dto.Instructions))
            {
                var line = "data: " + JsonSerializer.Serialize(evt) + "\n\n";
                await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(line));
                await Response.Body.FlushAsync();
            }
            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes("data: [DONE]\n\n"));
            await Response.Body.FlushAsync();
        }
        catch (Exception ex)
        {
            var err = "data: " + JsonSerializer.Serialize(new { field = "error", value = ex.Message }) + "\n\n";
            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(err));
            await Response.Body.FlushAsync();
        }
    }
}

public record AiWriteRequestDto(string Title, string? Instructions = null);