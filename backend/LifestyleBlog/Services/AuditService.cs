using Dapper;
using LifestyleBlog.Models;

namespace LifestyleBlog.Services;

public class AuditService(DatabaseService db)
{
    public async Task LogAsync(Guid userId, string action, string resourceType, Guid resourceId, string? details = null, string? ipAddress = null)
    {
        using var conn = db.CreateConnection();
        await conn.ExecuteAsync(@"
            INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
            VALUES (@UserId, @Action, @ResourceType, @ResourceId, @Details, @IpAddress)",
            new { UserId = userId, Action = action, ResourceType = resourceType, ResourceId = resourceId, Details = details, IpAddress = ipAddress });
    }

    public async Task<AuditLogsResult> GetLogsAsync(int page = 1, int pageSize = 50, string? action = null, Guid? userId = null)
    {
        using var conn = db.CreateConnection();
        var where = new List<string>();
        var parameters = new DynamicParameters();

        if (!string.IsNullOrEmpty(action))
        {
            where.Add("al.action ILIKE @Action");
            parameters.Add("Action", $"%{action}%");
        }
        if (userId.HasValue)
        {
            where.Add("al.user_id = @UserId");
            parameters.Add("UserId", userId.Value);
        }

        var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        parameters.Add("Limit", pageSize);
        parameters.Add("Offset", (page - 1) * pageSize);

        var sql = $@"
            SELECT al.*, p.full_name as UserName, p.email as UserEmail, p.avatar_url as UserAvatar
            FROM audit_logs al
            LEFT JOIN profiles p ON al.user_id = p.id
            {whereClause}
            ORDER BY al.created_at DESC
            LIMIT @Limit OFFSET @Offset;

            SELECT COUNT(*) FROM audit_logs al {whereClause};";

        using var multi = await conn.QueryMultipleAsync(sql, parameters);
        var logs = (await multi.ReadAsync<AuditLog>()).ToList();
        var total = await multi.ReadFirstAsync<int>();

        return new AuditLogsResult(logs, total, page, pageSize, (int)Math.Ceiling(total / (double)pageSize));
    }
}

public record AuditLogsResult(List<AuditLog> Logs, int Total, int Page, int PageSize, int TotalPages);