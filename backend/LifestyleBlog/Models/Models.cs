namespace LifestyleBlog.Models;

public class Post
{
    public Guid Id { get; set; }
    public Guid AuthorId { get; set; }
    public string Title { get; set; } = "";
    public string Slug { get; set; } = "";
    public string? Excerpt { get; set; }
    public string Content { get; set; } = "";
    public string? CoverImage { get; set; }
    public string? Category { get; set; }
    public string[]? Tags { get; set; }
    public string Status { get; set; } = "draft";
    public bool Featured { get; set; }
    public int ReadingTime { get; set; } = 1;
    public int Views { get; set; }
    public int Likes { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string? MetaDescription { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Joined
    public string? AuthorName { get; set; }
    public string? AuthorAvatar { get; set; }
    public string? AuthorUsername { get; set; }
    public int CommentCount { get; set; }
    public bool UserLiked { get; set; }
}

public class Comment
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Guid AuthorId { get; set; }
    public Guid? ParentId { get; set; }
    public string Content { get; set; } = "";
    public int Likes { get; set; }
    public string Status { get; set; } = "approved";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Joined
    public string? AuthorName { get; set; }
    public string? AuthorAvatar { get; set; }
    public string? AuthorUsername { get; set; }
    public List<Comment> Replies { get; set; } = [];
    public bool UserLiked { get; set; }
}

public class Profile
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string? Username { get; set; }
    public string? FullName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public string? Website { get; set; }
    public string? Twitter { get; set; }
    public string? Instagram { get; set; }
    public string Role { get; set; } = "reader";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// NEW: Audit log model
public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = "";
    public string ResourceType { get; set; } = "";
    public Guid? ResourceId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }

    // Joined from profiles
    public string? UserName { get; set; }
    public string? UserEmail { get; set; }
    public string? UserAvatar { get; set; }
}