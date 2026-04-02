namespace LifestyleBlog.DTOs;

public record CreatePostDto(
    string Title,
    string? Excerpt,
    string Content,
    string? CoverImage,
    string? Category,
    string[]? Tags,
    string Status,
    bool Featured,
    DateTime? ScheduledAt,
    string? MetaDescription
);

public record UpdatePostDto(
    string? Title,
    string? Excerpt,
    string? Content,
    string? CoverImage,
    string? Category,
    string[]? Tags,
    string? Status,
    bool? Featured,
    DateTime? ScheduledAt,
    string? MetaDescription
);

public record CreateCommentDto(
    Guid PostId,
    Guid? ParentId,
    string Content
);

public record UpdateProfileDto(
    string? Username,
    string? FullName,
    string? AvatarUrl,
    string? Bio,
    string? Website,
    string? Twitter,
    string? Instagram
);

public record NewsletterDto(string Email);

// FIX: Wrap role in an object so [FromBody] deserializes correctly
public record UpdateRoleDto(string Role);

public record ChatRequestDto(string Message, string SessionId);

// FIX: PostsQueryDto was missing entirely — caused compile error
/// <summary>DTO for the RAG /ask endpoint.</summary>
public record RagAskDto(string Question, Guid? PostId = null);

public record PostsQueryDto(
    string? Category = null,
    string? Tag = null,
    string? Search = null,
    bool? Featured = null,
    int Page = 1,
    int PageSize = 9
);