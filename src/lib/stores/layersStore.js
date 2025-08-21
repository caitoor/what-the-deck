import { writable } from 'svelte/store';

// Create the layers store
export const layersStore = writable([]);

// Helper function to create a new layer
function createLayer(type, field, index = 0) {
  return {
    id: field.id,
    type: type, // 'text' or 'image'
    name: field.mappedColumn || field.text || `${type === 'text' ? 'Text' : 'Image'} Field ${index + 1}`,
    zIndex: 0, // Will be calculated based on array position
    ...field // Spread all field properties
  };
}

// Store management functions
export const layerActions = {
  // Initialize layers from existing text and image fields
  initializeLayers(textFields, imageFields) {
    const layers = [];
    
    // Add image fields first (they'll be at lower indices = behind)
    imageFields.forEach((field, index) => {
      layers.push(createLayer('image', field, index));
    });
    
    // Add text fields after (they'll be at higher indices = in front)
    textFields.forEach((field, index) => {
      layers.push(createLayer('text', field, index));
    });
    
    // Update the store with proper reactivity
    layersStore.set([...layers]);
    return layers;
  },

  // Add a new layer
  addLayer(type, field) {
    layersStore.update(layers => {
      const newLayer = createLayer(type, field, layers.length);
      return [...layers, newLayer];
    });
  },

  // Remove a layer by ID
  removeLayer(layerId) {
    layersStore.update(layers => {
      return layers.filter(layer => layer.id !== layerId);
    });
  },

  // Update a layer's properties
  updateLayer(layerId, updates) {
    layersStore.update(layers => {
      return layers.map(layer => 
        layer.id === layerId 
          ? { ...layer, ...updates }
          : layer
      );
    });
  },

  // Move layer up (toward front) - increase array index
  moveLayerUp(layerId) {
    layersStore.update(layers => {
      const currentIndex = layers.findIndex(layer => layer.id === layerId);
      
      // Can't move the front-most layer further forward
      if (currentIndex === -1 || currentIndex >= layers.length - 1) {
        return layers;
      }
      
      // Create new array with swapped positions
      const newLayers = [...layers];
      const temp = newLayers[currentIndex];
      newLayers[currentIndex] = newLayers[currentIndex + 1];
      newLayers[currentIndex + 1] = temp;
      
      return newLayers;
    });
  },

  // Move layer down (toward back) - decrease array index
  moveLayerDown(layerId) {
    layersStore.update(layers => {
      const currentIndex = layers.findIndex(layer => layer.id === layerId);
      
      // Can't move the back-most layer further back
      if (currentIndex === -1 || currentIndex <= 0) {
        return layers;
      }
      
      // Create new array with swapped positions
      const newLayers = [...layers];
      const temp = newLayers[currentIndex];
      newLayers[currentIndex] = newLayers[currentIndex - 1];
      newLayers[currentIndex - 1] = temp;
      
      return newLayers;
    });
  },

  // Move layer to specific position
  moveLayerToPosition(layerId, newPosition) {
    layersStore.update(layers => {
      const currentIndex = layers.findIndex(layer => layer.id === layerId);
      
      if (currentIndex === -1 || newPosition < 0 || newPosition >= layers.length) {
        return layers;
      }
      
      const newLayers = [...layers];
      const [movedLayer] = newLayers.splice(currentIndex, 1);
      newLayers.splice(newPosition, 0, movedLayer);
      
      return newLayers;
    });
  },

  // Get layer by ID
  getLayer(layers, layerId) {
    return layers.find(layer => layer.id === layerId);
  },

  // Get layer index
  getLayerIndex(layers, layerId) {
    return layers.findIndex(layer => layer.id === layerId);
  },

  // Get z-index for a layer (based on array position)
  getLayerZIndex(layers, layerId) {
    const index = layers.findIndex(layer => layer.id === layerId);
    return index !== -1 ? index + 10 : 10; // Add base offset
  },

  // Check if layer can move up
  canMoveUp(layers, layerId) {
    const index = layers.findIndex(layer => layer.id === layerId);
    return index !== -1 && index < layers.length - 1;
  },

  // Check if layer can move down
  canMoveDown(layers, layerId) {
    const index = layers.findIndex(layer => layer.id === layerId);
    return index !== -1 && index > 0;
  },

  // Get layers separated by type (for backward compatibility)
  getLayersByType(layers) {
    return {
      textFields: layers.filter(layer => layer.type === 'text'),
      imageFields: layers.filter(layer => layer.type === 'image')
    };
  },

  // Clear all layers
  clearLayers() {
    layersStore.set([]);
  }
};
