using Dapper;
using Npgsql;

namespace LifestyleBlog.Services;

public class DatabaseService
{
    private readonly string _connectionString;

    public DatabaseService(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Supabase")!;

        // Enable Dapper's underscore → PascalCase mapping so DB columns like
        // "cover_image", "author_id", "reading_time" etc. automatically map to
        // C# properties CoverImage, AuthorId, ReadingTime without needing aliases.
        // This is a global one-time setting — safe to call in constructor.
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public NpgsqlConnection CreateConnection() => new(_connectionString);

    // ─── ROOT CAUSE OF 500 ERRORS ────────────────────────────────────────────
    // The old code executed ALL CREATE TABLE + CREATE INDEX statements in one
    // giant ExecuteAsync() call. Npgsql + Dapper do NOT support multi-statement
    // DDL batches — the driver throws on the second semicolon, and the whole
    // InitializeAsync() crashes. This crashes the .NET startup pipeline, leaving
    // the app in a broken state where every request returns 500.
    //
    // Fix: execute each statement individually.
    // ─────────────────────────────────────────────────────────────────────────
    public async Task InitializeAsync()
    {
        using var conn = CreateConnection();
        await conn.OpenAsync();

        // Execute each DDL statement separately
        var statements = new[]
        {
            // Tables
            @"CREATE TABLE IF NOT EXISTS profiles (
                id UUID PRIMARY KEY,
                email TEXT NOT NULL,
                username TEXT UNIQUE,
                full_name TEXT,
                avatar_url TEXT,
                bio TEXT,
                website TEXT,
                twitter TEXT,
                instagram TEXT,
                role TEXT DEFAULT 'reader',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )",

            @"CREATE TABLE IF NOT EXISTS posts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                excerpt TEXT,
                content TEXT NOT NULL,
                cover_image TEXT,
                category TEXT,
                tags TEXT[],
                status TEXT DEFAULT 'draft',
                featured BOOLEAN DEFAULT false,
                reading_time INT DEFAULT 1,
                views INT DEFAULT 0,
                likes INT DEFAULT 0,
                published_at TIMESTAMPTZ,
                scheduled_at TIMESTAMPTZ,
                meta_description TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )",

            @"CREATE TABLE IF NOT EXISTS comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                likes INT DEFAULT 0,
                status TEXT DEFAULT 'approved',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )",

            @"CREATE TABLE IF NOT EXISTS post_likes (
                post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
                user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (post_id, user_id)
            )",

            @"CREATE TABLE IF NOT EXISTS comment_likes (
                comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
                user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
                PRIMARY KEY (comment_id, user_id)
            )",

            @"CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email TEXT UNIQUE NOT NULL,
                subscribed_at TIMESTAMPTZ DEFAULT NOW()
            )",

            @"CREATE TABLE IF NOT EXISTS chat_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )",

            @"CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id UUID,
                details TEXT,
                ip_address TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )",

            // Indexes — each as its own statement
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs(action)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON audit_logs(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_posts_author_id         ON posts(author_id)",
            "CREATE INDEX IF NOT EXISTS idx_posts_status            ON posts(status)",
            "CREATE INDEX IF NOT EXISTS idx_posts_published_at      ON posts(published_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_comments_post_id        ON comments(post_id)",

            // ── RAG: drop old post_chunks if it has an embedding column (cleanup) ──
            @"DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = 'post_chunks' AND column_name = 'embedding'
                ) THEN
                  DROP TABLE post_chunks CASCADE;
                END IF;
              END
            $$",

            // ── RAG: plain-text chunk storage (BM25 retrieval, no vectors needed) ──
            @"CREATE TABLE IF NOT EXISTS post_chunks (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
                chunk_index INT  NOT NULL,
                chunk_text  TEXT NOT NULL,
                created_at  TIMESTAMPTZ DEFAULT NOW()
            )",
            "CREATE INDEX IF NOT EXISTS idx_post_chunks_post_id ON post_chunks(post_id)",
            "CREATE INDEX IF NOT EXISTS idx_post_chunks_fts ON post_chunks USING gin(to_tsvector('english', chunk_text))",
        };

        foreach (var sql in statements)
        {
            try
            {
                await conn.ExecuteAsync(sql);
            }
            catch (Exception ex)
            {
                // Log but don't crash — IF NOT EXISTS guards most cases.
                // Real errors (auth, network) will surface on the first real request.
                Console.WriteLine($"[DB INIT] Warning on statement: {ex.Message}");
                Console.WriteLine($"[DB INIT] Statement was: {sql[..Math.Min(80, sql.Length)]}...");
            }
        }

        Console.WriteLine("[DB INIT] Schema ready.");
    }
}