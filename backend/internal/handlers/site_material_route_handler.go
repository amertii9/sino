package handlers

import (
	"context"
	"net/http"
	"time"

	"truck-fleet-backend/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type MasterDataHandler struct {
	BaseHandler
}

func NewMasterDataHandler(base BaseHandler) *MasterDataHandler {
	return &MasterDataHandler{BaseHandler: base}
}

// --- SITES ---
func (h *MasterDataHandler) GetSites(c *gin.Context) {
	siteType := c.Query("type") // "loading", "dumping", "transition"
	filter := bson.M{}
	if siteType != "" {
		filter["type"] = siteType
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := h.DB.Sites.Find(ctx, filter, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sites"})
		return
	}
	defer cursor.Close(ctx)

	sites := make([]models.Site, 0)
	_ = cursor.All(ctx, &sites)
	c.JSON(http.StatusOK, sites)
}

func (h *MasterDataHandler) CreateSite(c *gin.Context) {
	var site models.Site
	if err := c.ShouldBindJSON(&site); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid site data: " + err.Error()})
		return
	}

	site.ID = bson.NewObjectID()
	site.CreatedAt = time.Now()
	if site.Status == "" {
		site.Status = "active"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := h.DB.Sites.InsertOne(ctx, site)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create site"})
		return
	}

	c.JSON(http.StatusCreated, site)
}

// --- MATERIALS ---
func (h *MasterDataHandler) GetMaterials(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	findOpts := options.Find().SetSort(bson.D{{Key: "name", Value: 1}})
	cursor, err := h.DB.Materials.Find(ctx, bson.M{}, findOpts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch materials"})
		return
	}
	defer cursor.Close(ctx)

	materials := make([]models.Material, 0)
	_ = cursor.All(ctx, &materials)
	c.JSON(http.StatusOK, materials)
}

func (h *MasterDataHandler) CreateMaterial(c *gin.Context) {
	var material models.Material
	if err := c.ShouldBindJSON(&material); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid material data: " + err.Error()})
		return
	}

	material.ID = bson.NewObjectID()
	material.CreatedAt = time.Now()
	if material.Status == "" {
		material.Status = "active"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := h.DB.Materials.InsertOne(ctx, material)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create material"})
		return
	}

	c.JSON(http.StatusCreated, material)
}

// --- ROUTES & PRICING ---
func (h *MasterDataHandler) GetRoutes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cursor, err := h.DB.Routes.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch routes"})
		return
	}
	defer cursor.Close(ctx)

	routes := make([]models.Route, 0)
	_ = cursor.All(ctx, &routes)
	c.JSON(http.StatusOK, routes)
}

func (h *MasterDataHandler) CreateRoute(c *gin.Context) {
	var route models.Route
	if err := c.ShouldBindJSON(&route); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route data: " + err.Error()})
		return
	}

	route.ID = bson.NewObjectID()
	route.CreatedAt = time.Now()
	if route.Status == "" {
		route.Status = "active"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := h.DB.Routes.InsertOne(ctx, route)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create route"})
		return
	}

	c.JSON(http.StatusCreated, route)
}

func (h *MasterDataHandler) UpdateSite(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid site ID"})
		return
	}

	var updateData models.Site
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid site data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"name":        updateData.Name,
			"location":    updateData.Location,
			"type":        updateData.Type,
			"description": updateData.Description,
			"status":      updateData.Status,
		},
	}

	_, err = h.DB.Sites.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update site"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Site updated successfully"})
}

func (h *MasterDataHandler) DeleteSite(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid site ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = h.DB.Sites.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete site"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Site deleted successfully"})
}

func (h *MasterDataHandler) UpdateMaterial(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid material ID"})
		return
	}

	var updateData models.Material
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid material data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"name":          updateData.Name,
			"default_unit":  updateData.DefaultUnit,
			"default_price": updateData.DefaultPrice,
			"description":   updateData.Description,
			"status":        updateData.Status,
		},
	}

	_, err = h.DB.Materials.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update material"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Material updated successfully"})
}

func (h *MasterDataHandler) DeleteMaterial(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid material ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = h.DB.Materials.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete material"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Material deleted successfully"})
}

func (h *MasterDataHandler) UpdateRoute(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route ID"})
		return
	}

	var updateData models.Route
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route data: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"loading_site_id":        updateData.LoadingSiteID,
			"loading_site_name":      updateData.LoadingSiteName,
			"dumping_site_id":        updateData.DumpingSiteID,
			"dumping_site_name":      updateData.DumpingSiteName,
			"transition_point_ids":   updateData.TransitionPointIDs,
			"transition_point_name":  updateData.TransitionPointName,
			"material_id":            updateData.MaterialID,
			"material_name":          updateData.MaterialName,
			"default_price":          updateData.DefaultPrice,
			"pricing_method":         updateData.PricingMethod,
			"status":                 updateData.Status,
		},
	}

	_, err = h.DB.Routes.UpdateOne(ctx, bson.M{"_id": objID}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update route"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Route updated successfully"})
}

func (h *MasterDataHandler) DeleteRoute(c *gin.Context) {
	id := c.Param("id")
	objID, err := bson.ObjectIDFromHex(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid route ID"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = h.DB.Routes.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete route"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Route deleted successfully"})
}

