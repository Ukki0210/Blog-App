using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LifestyleBlog.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = builder.Configuration
            .GetSection("AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:5173"];

        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("Content-Type", "Cache-Control", "X-Accel-Buffering");
    });
});

// ── JWT via Supabase JWKS (supports ECC P-256 + Legacy HS256) ─────────────────
var supabaseUrl = builder.Configuration["Supabase:Url"]!;
var legacySecret = builder.Configuration["Supabase:JwtSecret"];

List<SecurityKey> signingKeys = [];

if (!string.IsNullOrEmpty(legacySecret))
{
    signingKeys.Add(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(legacySecret))
    {
        KeyId = "legacy-hs256"
    });
}

try
{
    using var http = new HttpClient();
    var jwksUrl = $"{supabaseUrl}/auth/v1/.well-known/jwks.json";
    var jwksJson = await http.GetStringAsync(jwksUrl);
    Console.WriteLine($"[JWKS] Loaded from {jwksUrl}");

    var jwks = JsonSerializer.Deserialize<JsonElement>(jwksJson);
    if (jwks.TryGetProperty("keys", out var keys))
    {
        foreach (var key in keys.EnumerateArray())
        {
            var kty = key.TryGetProperty("kty", out var k) ? k.GetString() : null;
            var kid = key.TryGetProperty("kid", out var ki) ? ki.GetString() : null;

            if (kty == "EC")
            {
                var crv = key.TryGetProperty("crv", out var c) ? c.GetString() : "P-256";
                var x = key.TryGetProperty("x", out var xp) ? xp.GetString() : null;
                var y = key.TryGetProperty("y", out var yp) ? yp.GetString() : null;

                if (x != null && y != null)
                {
                    var ecdsa = ECDsa.Create();
                    ecdsa.ImportParameters(new ECParameters
                    {
                        Curve = crv == "P-384" ? ECCurve.NamedCurves.nistP384 : ECCurve.NamedCurves.nistP256,
                        Q = new ECPoint
                        {
                            X = Base64UrlDecode(x),
                            Y = Base64UrlDecode(y)
                        }
                    });
                    var ecKey = new ECDsaSecurityKey(ecdsa) { KeyId = kid };
                    signingKeys.Add(ecKey);
                    Console.WriteLine($"[JWKS] Parsed EC key kid={kid}");
                }
            }
            else if (kty == "RSA")
            {
                var n = key.TryGetProperty("n", out var np) ? np.GetString() : null;
                var e = key.TryGetProperty("e", out var ep) ? ep.GetString() : null;
                if (n != null && e != null)
                {
                    var rsa = RSA.Create();
                    rsa.ImportParameters(new RSAParameters
                    {
                        Modulus = Base64UrlDecode(n),
                        Exponent = Base64UrlDecode(e)
                    });
                    var rsaKey = new RsaSecurityKey(rsa) { KeyId = kid };
                    signingKeys.Add(rsaKey);
                }
            }
        }
    }
}
catch (Exception ex)
{
    Console.WriteLine($"[JWKS] Warning: Could not load JWKS — {ex.Message}");
}

Console.WriteLine($"[JWT] Total signing keys loaded: {signingKeys.Count}");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
            {
                if (string.IsNullOrEmpty(kid)) return signingKeys;
                var matched = signingKeys.Where(k => k.KeyId == kid).ToList();
                return matched.Count > 0 ? matched : signingKeys;
            },
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine($"[JWT FAIL] {ctx.Exception.GetType().Name}: {ctx.Exception.Message}");
                return Task.CompletedTask;
            },
            OnTokenValidated = ctx =>
            {
                var sub = ctx.Principal?.FindFirst("sub")?.Value;
                Console.WriteLine($"[JWT OK] sub={sub}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddScoped<PostService>();
builder.Services.AddScoped<CommentService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<AuditService>();

// RAG service
builder.Services.AddHttpClient<RagService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

// AI Writing Assistant service
builder.Services.AddHttpClient<AiWriteService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(90);
});

builder.Services.AddHttpClient<ChatbotService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// ── App pipeline ──────────────────────────────────────────────────────────────
var app = builder.Build();

var dbService = app.Services.GetRequiredService<DatabaseService>();
try
{
    await dbService.InitializeAsync();
}
catch (Exception ex)
{
    Console.WriteLine($"Warning: Could not initialize database at startup: {ex.Message}");
    Console.WriteLine("App will continue - database will connect on first request.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

// ── Serve React static files from wwwroot ─────────────────────────────────────
// This serves the built frontend (index.html, JS, CSS, assets)
app.UseDefaultFiles();        // serves index.html for "/"
app.UseStaticFiles();         // serves files from wwwroot/

// ── API routes ────────────────────────────────────────────────────────────────
app.MapControllers();

// ── SPA fallback — send all non-API routes to React's index.html ──────────────
// This makes React Router work for URLs like /post/my-article, /write, /auth etc.
app.MapFallbackToFile("index.html");

app.Run();

// ── Helpers ───────────────────────────────────────────────────────────────────
static byte[] Base64UrlDecode(string input)
{
    var s = input.Replace('-', '+').Replace('_', '/');
    switch (s.Length % 4)
    {
        case 2: s += "=="; break;
        case 3: s += "="; break;
    }
    return Convert.FromBase64String(s);
}