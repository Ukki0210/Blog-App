using Dapper;
using LifestyleBlog.DTOs;
using LifestyleBlog.Models;

namespace LifestyleBlog.Services;

public class PostService(DatabaseService db)
{
    private static string GenerateSlug(string title)
    {
        var slug = title.ToLower()
            .Replace(" ", "-")
            .Replace("'", "")
            .Replace("\"", "")
            .Replace(".", "")
            .Replace(",", "")
            .Replace("!", "")
            .Replace("?", "");
        return slug + "-" + Guid.NewGuid().ToString()[..6];
    }

    private static int CalculateReadingTime(string content)
    {
        var wordCount = content.Split(' ').Length;
        return Math.Max(1, (int)Math.Ceiling(wordCount / 200.0));
    }

    public async Task<(List<Post> Posts, int Total)> GetPostsAsync(PostsQueryDto query, Guid? currentUserId = null)
    {
        using var conn = db.CreateConnection();
        var where = new List<string> { "p.status = 'published'" };
        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(query.Category))
        {
            where.Add("p.category = @Category");
            parameters.Add("Category", query.Category);
        }
        if (!string.IsNullOrEmpty(query.Tag))
        {
            where.Add("@Tag = ANY(p.tags)");
            parameters.Add("Tag", query.Tag);
        }
        if (!string.IsNullOrEmpty(query.Search))
        {
            where.Add("(p.title ILIKE @Search OR p.excerpt ILIKE @Search OR p.content ILIKE @Search)");
            parameters.Add("Search", $"%{query.Search}%");
        }
        if (query.Featured.HasValue)
        {
            where.Add("p.featured = @Featured");
            parameters.Add("Featured", query.Featured.Value);
        }

        var whereClause = "WHERE " + string.Join(" AND ", where);
        parameters.Add("Limit", query.PageSize);
        parameters.Add("Offset", (query.Page - 1) * query.PageSize);

        var sql = $@"
            SELECT p.*,
                   pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'approved') as CommentCount
                   {(currentUserId.HasValue ? ", EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = @UserId) as UserLiked" : ", false as UserLiked")}
            FROM posts p
            LEFT JOIN profiles pr ON p.author_id = pr.id
            {whereClause}
            ORDER BY p.published_at DESC
            LIMIT @Limit OFFSET @Offset;

            SELECT COUNT(*) FROM posts p {whereClause};";

        if (currentUserId.HasValue) parameters.Add("UserId", currentUserId.Value);

        using var multi = await conn.QueryMultipleAsync(sql, parameters);
        var posts = (await multi.ReadAsync<Post>()).ToList();
        var total = await multi.ReadFirstAsync<int>();
        return (posts, total);
    }

    public async Task<Post?> GetPostBySlugAsync(string slug, Guid? currentUserId = null)
    {
        using var conn = db.CreateConnection();
        var sql = @"
            SELECT p.*,
                   pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'approved') as CommentCount,
                   @UserId IS NOT NULL AND EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = @UserId) as UserLiked
            FROM posts p
            LEFT JOIN profiles pr ON p.author_id = pr.id
            WHERE p.slug = @Slug AND p.status = 'published'";

        var post = await conn.QueryFirstOrDefaultAsync<Post>(sql, new { Slug = slug, UserId = currentUserId });
        if (post != null)
            await conn.ExecuteAsync("UPDATE posts SET views = views + 1 WHERE id = @Id", new { post.Id });
        return post;
    }

    // FIX: Added GetPostByIdAsync — needed by GetRelated endpoint which was using slug lookup with a Guid
    public async Task<Post?> GetPostByIdAsync(Guid id, Guid? currentUserId = null)
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<Post>(@"
            SELECT p.*,
                   pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   0 as CommentCount, false as UserLiked
            FROM posts p
            LEFT JOIN profiles pr ON p.author_id = pr.id
            WHERE p.id = @Id",
            new { Id = id });
    }

    // NEW: Get a single post by ID for edit page (any status)
    public async Task<Post?> GetPostByIdForEditAsync(Guid id, Guid userId, string role)
    {
        using var conn = db.CreateConnection();
        var post = await conn.QueryFirstOrDefaultAsync<Post>(@"
            SELECT p.*,
                   pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   0 as CommentCount, false as UserLiked
            FROM posts p
            LEFT JOIN profiles pr ON p.author_id = pr.id
            WHERE p.id = @Id",
            new { Id = id });

        if (post == null) return null;
        // Only author, editor, or admin can edit
        if (post.AuthorId != userId && role != "admin" && role != "editor") return null;
        return post;
    }

    public async Task<List<Post>> GetAllPostsForAdminAsync(Guid authorId, string role)
    {
        using var conn = db.CreateConnection();
        var whereClause = role == "admin" || role == "editor" ? "" : "WHERE p.author_id = @AuthorId";
        var sql = $@"
            SELECT p.*, pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as CommentCount, false as UserLiked
            FROM posts p LEFT JOIN profiles pr ON p.author_id = pr.id
            {whereClause}
            ORDER BY p.created_at DESC";
        return (await conn.QueryAsync<Post>(sql, new { AuthorId = authorId })).ToList();
    }

    public async Task<Post> CreatePostAsync(CreatePostDto dto, Guid authorId)
    {
        using var conn = db.CreateConnection();
        var id = Guid.NewGuid();
        var slug = GenerateSlug(dto.Title);
        var readingTime = CalculateReadingTime(dto.Content);
        var publishedAt = dto.Status == "published" ? DateTime.UtcNow : (DateTime?)null;

        await conn.ExecuteAsync(@"
            INSERT INTO posts (id, author_id, title, slug, excerpt, content, cover_image, category, tags, status, featured, reading_time, published_at, scheduled_at, meta_description)
            VALUES (@Id, @AuthorId, @Title, @Slug, @Excerpt, @Content, @CoverImage, @Category, @Tags, @Status, @Featured, @ReadingTime, @PublishedAt, @ScheduledAt, @MetaDescription)",
            new { Id = id, AuthorId = authorId, dto.Title, Slug = slug, dto.Excerpt, dto.Content, dto.CoverImage, dto.Category, Tags = dto.Tags, dto.Status, dto.Featured, ReadingTime = readingTime, PublishedAt = publishedAt, dto.ScheduledAt, dto.MetaDescription });

        return (await conn.QueryFirstAsync<Post>("SELECT * FROM posts WHERE id = @Id", new { Id = id }));
    }

    public async Task<Post?> UpdatePostAsync(Guid id, UpdatePostDto dto, Guid userId, string role)
    {
        using var conn = db.CreateConnection();
        var post = await conn.QueryFirstOrDefaultAsync<Post>("SELECT * FROM posts WHERE id = @Id", new { Id = id });
        if (post == null) return null;
        if (post.AuthorId != userId && role != "admin" && role != "editor") return null;

        var title = dto.Title ?? post.Title;
        var content = dto.Content ?? post.Content;
        var status = dto.Status ?? post.Status;
        var publishedAt = status == "published" && post.Status != "published" ? DateTime.UtcNow : post.PublishedAt;

        await conn.ExecuteAsync(@"
            UPDATE posts SET
                title = @Title, excerpt = @Excerpt, content = @Content, cover_image = @CoverImage,
                category = @Category, tags = @Tags, status = @Status, featured = @Featured,
                reading_time = @ReadingTime, published_at = @PublishedAt, scheduled_at = @ScheduledAt,
                meta_description = @MetaDescription, updated_at = NOW()
            WHERE id = @Id",
            new
            {
                Id = id, Title = title, Excerpt = dto.Excerpt ?? post.Excerpt,
                Content = content, CoverImage = dto.CoverImage ?? post.CoverImage,
                Category = dto.Category ?? post.Category, Tags = dto.Tags ?? post.Tags,
                Status = status, Featured = dto.Featured ?? post.Featured,
                ReadingTime = CalculateReadingTime(content), PublishedAt = publishedAt,
                ScheduledAt = dto.ScheduledAt ?? post.ScheduledAt,
                MetaDescription = dto.MetaDescription ?? post.MetaDescription
            });

        return await conn.QueryFirstAsync<Post>("SELECT * FROM posts WHERE id = @Id", new { Id = id });
    }

    public async Task<bool> DeletePostAsync(Guid id, Guid userId, string role)
    {
        using var conn = db.CreateConnection();
        var post = await conn.QueryFirstOrDefaultAsync<Post>("SELECT * FROM posts WHERE id = @Id", new { Id = id });
        if (post == null) return false;
        if (post.AuthorId != userId && role != "admin") return false;
        await conn.ExecuteAsync("DELETE FROM posts WHERE id = @Id", new { Id = id });
        return true;
    }

    public async Task<bool> ToggleLikeAsync(Guid postId, Guid userId)
    {
        using var conn = db.CreateConnection();
        var existing = await conn.QueryFirstOrDefaultAsync("SELECT 1 FROM post_likes WHERE post_id = @PostId AND user_id = @UserId", new { PostId = postId, UserId = userId });
        if (existing != null)
        {
            await conn.ExecuteAsync("DELETE FROM post_likes WHERE post_id = @PostId AND user_id = @UserId", new { PostId = postId, UserId = userId });
            await conn.ExecuteAsync("UPDATE posts SET likes = likes - 1 WHERE id = @PostId", new { PostId = postId });
            return false;
        }
        await conn.ExecuteAsync("INSERT INTO post_likes (post_id, user_id) VALUES (@PostId, @UserId)", new { PostId = postId, UserId = userId });
        await conn.ExecuteAsync("UPDATE posts SET likes = likes + 1 WHERE id = @PostId", new { PostId = postId });
        return true;
    }

    public async Task<List<Post>> GetRelatedPostsAsync(Guid postId, string? category, string[]? tags)
    {
        using var conn = db.CreateConnection();
        return (await conn.QueryAsync<Post>(@"
            SELECT p.*, pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername, 0 as CommentCount, false as UserLiked
            FROM posts p LEFT JOIN profiles pr ON p.author_id = pr.id
            WHERE p.id != @PostId AND p.status = 'published'
              AND (p.category = @Category OR p.tags && @Tags)
            ORDER BY p.published_at DESC LIMIT 3",
            new { PostId = postId, Category = category, Tags = tags ?? [] })).ToList();
    }

    public async Task<object> GetStatsAsync()
    {
        using var conn = db.CreateConnection();
        return await conn.QueryFirstAsync<dynamic>(@"
            SELECT
                (SELECT COUNT(*) FROM posts WHERE status = 'published') as published_posts,
                (SELECT COUNT(*) FROM posts WHERE status = 'draft') as draft_posts,
                (SELECT COUNT(*) FROM posts) as total_posts,
                (SELECT COALESCE(SUM(views), 0) FROM posts) as total_views,
                (SELECT COALESCE(SUM(likes), 0) FROM posts) as total_likes,
                (SELECT COUNT(*) FROM comments WHERE status = 'approved') as total_comments,
                (SELECT COUNT(*) FROM profiles) as total_users,
                (SELECT COUNT(*) FROM newsletter_subscribers) as subscribers");
    }
}