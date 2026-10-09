package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	MongoURI       string
	DBName         string
	JWTSecret      string
	CORSOrigins    string
	Env            string
	TrustedProxies []string
}

func LoadConfig() *Config {
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	dbName := os.Getenv("MONGO_DB_NAME")
	if dbName == "" {
		dbName = "truck_fleet_db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	defaultSecret := "fleet-hauling-management-secret-key-2026-supersecure"
	if jwtSecret == "" {
		jwtSecret = defaultSecret
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,*"
	}

	env := strings.ToLower(os.Getenv("ENV"))
	if env == "" {
		env = strings.ToLower(os.Getenv("GIN_MODE"))
	}
	if env == "" {
		env = "development"
	}

	var trustedProxies []string
	if rawProxies := os.Getenv("TRUSTED_PROXIES"); rawProxies != "" {
		for _, p := range strings.Split(rawProxies, ",") {
			trimmed := strings.TrimSpace(p)
			if trimmed != "" {
				trustedProxies = append(trustedProxies, trimmed)
			}
		}
	}

	if env == "production" || env == "release" {
		if jwtSecret == defaultSecret {
			log.Println("[SECURITY WARNING] Running in production with default JWT_SECRET! Please set a strong unique JWT_SECRET in production environment.")
		}
	}

	return &Config{
		Port:           port,
		MongoURI:       mongoURI,
		DBName:         dbName,
		JWTSecret:      jwtSecret,
		CORSOrigins:    corsOrigins,
		Env:            env,
		TrustedProxies: trustedProxies,
	}
}
