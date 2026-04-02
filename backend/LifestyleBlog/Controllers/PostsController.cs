using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using LifestyleBlog.DTOs;
using LifestyleBlog.Services;
using System.Security.Claims;

namespace LifestyleBlog.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController(PostService postService, UserService userService, AuditService auditService, RagService ragService) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<string> GetCurrentRoleAsync()
    {
        if (CurrentUserId == null) return "reader";
        var profile = await userService.GetProfileAsync(CurrentUserId.Value);
        return profile?.Role ?? "reader";
    }

    [HttpGet]
    public async Task<IActionResult> GetPosts([FromQuery] PostsQueryDto query)
    {
        var (posts, total) = await postService.GetPostsAsync(query, CurrentUserId);
        return Ok(new
        {
            posts,
            total,
            page = query.Page,
            pageSize = query.PageSize,
            totalPages = (int)Math.Ceiling(total / (double)query.PageSize)
        });
    }

    [HttpGet("{slug}")]
    public async Task<IActionResult> GetPost(string slug)
    {
        var post = await postService.GetPostBySlugAsync(slug, CurrentUserId);
        if (post == null) return NotFound();
        return Ok(post);
    }

    [HttpGet("related/{id}")]
    public async Task<IActionResult> GetRelated(Guid id)
    {
        var post = await postService.GetPostByIdAsync(id, null);
        return Ok(await postService.GetRelatedPostsAsync(id, post?.Category, post?.Tags));
    }

    [Authorize]
    [HttpGet("admin/all")]
    public async Task<IActionResult> GetAllAdmin()
    {
        if (CurrentUserId == null) return Unauthorized();
        var role = await GetCurrentRoleAsync();
        if (role == "reader") return Forbid();
        var posts = await postService.GetAllPostsForAdminAsync(CurrentUserId.Value, role);
        return Ok(posts);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
    {
        if (CurrentUserId == null) return Unauthorized();
        var role = await GetCurrentRoleAsync();
        if (role == "reader") return Forbid();
        var post = await postService.CreatePostAsync(dto, CurrentUserId.Value);
        await auditService.LogAsync(CurrentUserId.Value, "post.create", "post", post.Id, $"Created post '{post.Title}' [{post.Status}]");
        // RAG ingestion runs in the background — doesn't delay the HTTP response
        _ = Task.Run(() => ragService.IngestPostAsync(post.Id, post.Title, post.Content));
        return CreatedAtAction(nameof(GetPost), new { slug = post.Slug }, post);
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(Guid id, [FromBody] UpdatePostDto dto)
    {
        if (CurrentUserId == null) return Unauthorized();
        var role = await GetCurrentRoleAsync();
        var post = await postService.UpdatePostAsync(id, dto, CurrentUserId.Value, role);
        if (post == null) return NotFound();
        await auditService.LogAsync(CurrentUserId.Value, "post.update", "post", id, $"Updated post '{post.Title}' -> status: {post.Status}");
        // Re-ingest updated content so the vector DB stays in sync
        _ = Task.Run(() => ragService.IngestPostAsync(post.Id, post.Title, post.Content));
        return Ok(post);
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(Guid id)
    {
        if (CurrentUserId == null) return Unauthorized();
        var role = await GetCurrentRoleAsync();
        var result = await postService.DeletePostAsync(id, CurrentUserId.Value, role);
        if (!result) return NotFound();
        await auditService.LogAsync(CurrentUserId.Value, "post.delete", "post", id, "Post deleted");
        // post_chunks are deleted automatically via ON DELETE CASCADE
        return NoContent();
    }

    [Authorize]
    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        if (CurrentUserId == null) return Unauthorized();
        var liked = await postService.ToggleLikeAsync(id, CurrentUserId.Value);
        return Ok(new { liked });
    }

    [Authorize]
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await postService.GetStatsAsync();
        return Ok(stats);
    }
}