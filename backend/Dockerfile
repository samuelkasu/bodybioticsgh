# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Restore before copying sources: the layer is cached until a csproj changes.
COPY Directory.Build.props Directory.Packages.props nuget.config ./
COPY src/BodyBiotics.Api/BodyBiotics.Api.csproj src/BodyBiotics.Api/
COPY src/BodyBiotics.Domain/BodyBiotics.Domain.csproj src/BodyBiotics.Domain/
COPY src/BodyBiotics.Infrastructure/BodyBiotics.Infrastructure.csproj src/BodyBiotics.Infrastructure/
RUN dotnet restore src/BodyBiotics.Api/BodyBiotics.Api.csproj

COPY src/ src/
RUN dotnet publish src/BodyBiotics.Api/BodyBiotics.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Non-root, and a fixed uid so a mounted volume's ownership is predictable.
RUN addgroup -g 1001 -S api && adduser -S api -u 1001 -G api
COPY --from=build --chown=api:api /app .

ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

USER api
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "BodyBiotics.Api.dll"]
