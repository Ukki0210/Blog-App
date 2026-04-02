using Dapper;
using LifestyleBlog.DTOs;
using LifestyleBlog.Models;

namespace LifestyleBlog.Services;

public class CommentService(DatabaseService db)
{
    public async Task<List<Comment>> GetPostCommentsAsync(Guid postId, Guid? currentUserId = null)
    {
        using var conn = db.CreateConnection();
        var allComments = (await conn.QueryAsync<Comment>(@"
            SELECT c.*, pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername,
                   @UserId IS NOT NULL AND EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = @UserId) as UserLiked
            FROM comments c
            LEFT JOIN profiles pr ON c.author_id = pr.id
            WHERE c.post_id = @PostId AND c.status = 'approved'
            ORDER BY c.created_at ASC",
            new { PostId = postId, UserId = currentUserId })).ToList();

        var rootComments = allComments.Where(c => c.ParentId == null).ToList();
        foreach (var root in rootComments)
            root.Replies = allComments.Where(c => c.ParentId == root.Id).ToList();
        return rootComments;
    }

    public async Task<Comment> CreateCommentAsync(CreateCommentDto dto, Guid authorId)
    {
        using var conn = db.CreateConnection();
        var id = Guid.NewGuid();
        await conn.ExecuteAsync(@"
            INSERT INTO comments (id, post_id, author_id, parent_id, content)
            VALUES (@Id, @PostId, @AuthorId, @ParentId, @Content)",
            new { Id = id, dto.PostId, AuthorId = authorId, dto.ParentId, dto.Content });
        return await conn.QueryFirstAsync<Comment>(@"
            SELECT c.*, pr.full_name as AuthorName, pr.avatar_url as AuthorAvatar, pr.username as AuthorUsername, false as UserLiked
            FROM comments c LEFT JOIN profiles pr ON c.author_id = pr.id WHERE c.id = @Id", new { Id = id });
    }

    public async Task<bool> DeleteCommentAsync(Guid id, Guid userId, string role)
    {
        using var conn = db.CreateConnection();
        var comment = await conn.QueryFirstOrDefaultAsync<Comment>("SELECT * FROM comments WHERE id = @Id", new { Id = id });
        if (comment == null) return false;
        if (comment.AuthorId != userId && role != "admin") return false;
        await conn.ExecuteAsync("DELETE FROM comments WHERE id = @Id", new { Id = id });
        return true;
    }

    public async Task<bool> ToggleLikeAsync(Guid commentId, Guid userId)
    {
        using var conn = db.CreateConnection();
        var existing = await conn.QueryFirstOrDefaultAsync("SELECT 1 FROM comment_likes WHERE comment_id = @CommentId AND user_id = @UserId", new { CommentId = commentId, UserId = userId });
        if (existing != null)
        {
            await conn.ExecuteAsync("DELETE FROM comment_likes WHERE comment_id = @CommentId AND user_id = @UserId", new { CommentId = commentId, UserId = userId });
            await conn.ExecuteAsync("UPDATE comments SET likes = likes - 1 WHERE id = @CommentId", new { CommentId = commentId });
            return false;
        }
        await conn.ExecuteAsync("INSERT INTO comment_likes (comment_id, user_id) VALUES (@CommentId, @UserId)", new { CommentId = commentId, UserId = userId });
        await conn.ExecuteAsync("UPDATE comments SET likes = likes + 1 WHERE id = @CommentId", new { CommentId = commentId });
        return true;
    }
}
