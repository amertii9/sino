package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds standard production security headers
func SecurityHeadersMiddleware(isProduction bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent MIME-sniffing
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")

		// Prevent clickjacking
		c.Writer.Header().Set("X-Frame-Options", "DENY")

		// Cross-Site Scripting protection
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")

		// Referrer policy
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Content Security Policy for API server
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")

		// Restrict browser features
		c.Writer.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

		// Cross-Origin policies
		c.Writer.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		c.Writer.Header().Set("Cross-Origin-Resource-Policy", "same-origin")

		// HSTS only in production (requires HTTPS)
		if isProduction {
			c.Writer.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		// Remove server fingerprinting
		c.Writer.Header().Del("X-Powered-By")
		c.Writer.Header().Del("Server")

		c.Next()
	}
}

// BodyLimitMiddleware prevents denial of service by rejecting payloads exceeding maxBytes
func BodyLimitMiddleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("Request payload exceeds maximum allowed size of %d MB", maxBytes/(1024*1024)),
			})
			c.Abort()
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// clientTracker tracks request history for an IP
type clientTracker struct {
	count     int
	resetTime time.Time
}

// IPRateLimiter provides thread-safe sliding-window rate limiting per IP address
type IPRateLimiter struct {
	sync.RWMutex
	clients map[string]*clientTracker
	limit   int
	window  time.Duration
}

// NewIPRateLimiter creates a new rate limiter with background cleanup
func NewIPRateLimiter(limit int, window time.Duration) *IPRateLimiter {
	limiter := &IPRateLimiter{
		clients: make(map[string]*clientTracker),
		limit:   limit,
		window:  window,
	}

	// Periodic cleanup of expired clients to avoid memory growth
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			limiter.cleanup()
		}
	}()

	return limiter
}

func (l *IPRateLimiter) cleanup() {
	l.Lock()
	defer l.Unlock()
	now := time.Now()
	for ip, tracker := range l.clients {
		if now.After(tracker.resetTime) {
			delete(l.clients, ip)
		}
	}
}

func (l *IPRateLimiter) Allow(ip string) (bool, time.Duration) {
	l.Lock()
	defer l.Unlock()

	now := time.Now()
	tracker, exists := l.clients[ip]

	if !exists || now.After(tracker.resetTime) {
		l.clients[ip] = &clientTracker{
			count:     1,
			resetTime: now.Add(l.window),
		}
		return true, 0
	}

	if tracker.count >= l.limit {
		retryAfter := tracker.resetTime.Sub(now)
		return false, retryAfter
	}

	tracker.count++
	return true, 0
}

// RateLimitMiddleware returns a Gin middleware applying rate limiting per client IP
func RateLimitMiddleware(limiter *IPRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		allowed, retryAfter := limiter.Allow(ip)

		if !allowed {
			seconds := int(retryAfter.Seconds())
			if seconds < 1 {
				seconds = 1
			}
			c.Header("Retry-After", fmt.Sprintf("%d", seconds))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many requests. Please slow down and try again shortly.",
				"retry_after": fmt.Sprintf("%ds", seconds),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// Hardened CORSMiddleware that checks allowed origins
func HardenedCORSMiddleware(allowedOriginsStr string) gin.HandlerFunc {
	origins := strings.Split(allowedOriginsStr, ",")
	originMap := make(map[string]bool)
	allowAll := false

	for _, o := range origins {
		trimmed := strings.TrimSpace(o)
		if trimmed == "*" {
			allowAll = true
		} else if trimmed != "" {
			originMap[trimmed] = true
		}
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" {
			if allowAll {
				// If allowAll, set the incoming origin to maintain credentials support safely
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			} else if originMap[origin] {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		} else if allowAll {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
