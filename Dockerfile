# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build args for Vite env vars (injected at build time by Render)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Write .env so Vite picks them up during build
RUN echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" > .env && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Build the .NET backend
# ─────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build

WORKDIR /app/backend

# Copy csproj and restore (layer cache)
COPY backend/LifestyleBlog/LifestyleBlog.csproj ./
RUN dotnet restore

# Copy backend source and publish
COPY backend/LifestyleBlog/ ./
RUN dotnet publish -c Release -o /app/publish

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Final runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime

WORKDIR /app

# Copy published backend
COPY --from=backend-build /app/publish .

# Copy built frontend into wwwroot so ASP.NET serves it as static files
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Render assigns PORT via environment variable
ENV ASPNETCORE_URLS=http://+:${PORT:-10000}
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 10000

ENTRYPOINT ["dotnet", "LifestyleBlog.dll"]