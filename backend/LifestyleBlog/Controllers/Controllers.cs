using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LifestyleBlog.DTOs;
using LifestyleBlog.Services;
using System.Security.Claims;

namespace LifestyleBlog.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CommentsController(CommentService commentService, UserService userService, AuditService auditService) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private async Task<string> GetRoleAsync() => CurrentUserId == null ? "reader" : (await userService.GetProfileAsync(CurrentUserId.Value))?.Role ?? "reader";

    [HttpGet("{postId}")]
    public async Task<IActionResult> GetComments(Guid postId)
        => Ok(await commentService.GetPostCommentsAsync(postId, CurrentUserId));

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateComment([FromBody] CreateCommentDto dto)
    {
        if (CurrentUserId == null) return Unauthorized();
        var comment = await commentService.CreateCommentAsync(dto, CurrentUserId.Value);
        await auditService.LogAsync(CurrentUserId.Value, "comment.create", "comment", comment.Id, $"Commented on post {dto.PostId}");
        return CreatedAtAction(nameof(GetComments), new { postId = dto.PostId }, comment);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteComment(Guid id)
    {
        if (CurrentUserId == null) return Unauthorized();
        var role = await GetRoleAsync();
        var result = await commentService.DeleteCommentAsync(id, CurrentUserId.Value, role);
        if (result) await auditService.LogAsync(CurrentUserId.Value, "comment.delete", "comment", id, "Comment deleted");
        return result ? NoContent() : NotFound();
    }

    [Authorize]
    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        if (CurrentUserId == null) return Unauthorized();
        var liked = await commentService.ToggleLikeAsync(id, CurrentUserId.Value);
        return Ok(new { liked });
    }
}

[ApiController]
[Route("api/[controller]")]
public class UsersController(UserService userService, AuditService auditService) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private string? CurrentEmail => User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue("email");

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        if (CurrentUserId == null || CurrentEmail == null) return Unauthorized();
        var profile = await userService.UpsertProfileAsync(CurrentUserId.Value, CurrentEmail);
        return Ok(profile);
    }

    [Authorize]
    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        if (CurrentUserId == null || CurrentEmail == null) return Unauthorized();
        var profile = await userService.UpsertProfileAsync(CurrentUserId.Value, CurrentEmail, dto);
        await auditService.LogAsync(CurrentUserId.Value, "user.update_profile", "user", CurrentUserId.Value, "Profile updated");
        return Ok(profile);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProfile(Guid id)
    {
        var profile = await userService.GetProfileAsync(id);
        return profile == null ? NotFound() : Ok(profile);
    }

    [Authorize]
    [HttpGet("admin/all")]
    public async Task<IActionResult> GetAllUsers()
    {
        if (CurrentUserId == null) return Unauthorized();
        var me = await userService.GetProfileAsync(CurrentUserId.Value);
        if (me?.Role != "admin") return Forbid();
        return Ok(await userService.GetAllUsersAsync());
    }

    // FIX: Changed [FromBody] string role -> [FromBody] UpdateRoleDto dto
    // Raw strings fail JSON deserialization in .NET minimal API/controllers
    [Authorize]
    [HttpPut("{id}/role")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleDto dto)
    {
        if (CurrentUserId == null) return Unauthorized();
        var me = await userService.GetProfileAsync(CurrentUserId.Value);
        if (me?.Role != "admin") return Forbid();
        await userService.UpdateUserRoleAsync(id, dto.Role);
        await auditService.LogAsync(CurrentUserId.Value, "user.role_change", "user", id, $"Role changed to '{dto.Role}'");
        return NoContent();
    }

    [HttpPost("newsletter")]
    public async Task<IActionResult> Subscribe([FromBody] NewsletterDto dto)
    {
        await userService.SubscribeNewsletterAsync(dto.Email);
        return Ok(new { message = "Subscribed successfully!" });
    }

    [Authorize]
    [HttpGet("admin/audit-logs")]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? action = null, [FromQuery] string? userId = null)
    {
        if (CurrentUserId == null) return Unauthorized();
        var me = await userService.GetProfileAsync(CurrentUserId.Value);
        if (me?.Role != "admin") return Forbid();
        var logs = await auditService.GetLogsAsync(page, pageSize, action, userId != null && Guid.TryParse(userId, out var uid) ? uid : null);
        return Ok(logs);
    }
}

[ApiController]
[Route("api/[controller]")]
public class ChatController(ChatbotService chatbotService) : ControllerBase
{
    [HttpPost("stream")]
    public async Task StreamChat([FromBody] ChatRequestDto request)
    {
        // SSE streaming needs these headers set explicitly —
        // the CORS middleware runs before the response starts but
        // SSE connections need Access-Control-Allow-Origin too.
        var origin = Request.Headers.Origin.ToString();
        if (!string.IsNullOrEmpty(origin))
            Response.Headers.Append("Access-Control-Allow-Origin", origin);
        Response.Headers.Append("Access-Control-Allow-Credentials", "true");
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        await foreach (var chunk in chatbotService.StreamResponseAsync(request))
        {
            var data = $"data: {System.Text.Json.JsonSerializer.Serialize(chunk)}\n\n";
            await Response.WriteAsync(data);
            await Response.Body.FlushAsync();
        }

        await Response.WriteAsync("data: [DONE]\n\n");
        await Response.Body.FlushAsync();
    }
}