<script>
  import { createEventDispatcher } from "svelte";
  import { layersStore, layerActions } from "../stores/layersStore.js";

  const dispatch = createEventDispatcher();

  export let availableFields = [];

  let cardTemplate = {
    width: 661,
    height: 1039,
    backgroundColor: "#ffffff",
    borderColor: "#000000",
    borderWidth: 1,
    backgroundImage: null,
    overlayImage: null,
    // Keep these for backward compatibility
    textFields: [],
    imageFields: [],
  };

  let draggedField = null;
  let selectedField = null;
  let resizingField = null;
  let backgroundImageFile = null;
  let overlayImageFile = null;
  let imageBasePath = "./assets/images/";
  let localImageFiles = new Map(); // Store loaded image files by filename

  // Subscribe to the layers store
  $: layers = $layersStore;

  // Auto-create fields when available fields change (after import)
  $: {
    if (availableFields.length > 0) {
      // Only auto-create if we don't already have fields for these columns
      const existingColumns = layers
        .map((layer) => layer.mappedColumn)
        .filter(Boolean);
      const newColumns = availableFields.filter(
        (field) => !existingColumns.includes(field),
      );

      // Create fields if there are new columns OR if there are no layers at all
      if (newColumns.length > 0 || layers.length === 0) {
        // Use setTimeout to ensure this runs after current reactive cycle
        setTimeout(() => autoCreateFields(), 0);
      }
    }
  }

  // Keep legacy arrays updated for backward compatibility
  $: {
    const textFields = layers.filter((layer) => layer.type === "text");
    const imageFields = layers.filter((layer) => layer.type === "image");
    cardTemplate.textFields = textFields;
    cardTemplate.imageFields = imageFields;
  }

  function isImageColumn(fieldName) {
    const lowerName = fieldName.toLowerCase();
    return (
      lowerName.includes("image") ||
      lowerName.includes("photo") ||
      lowerName.includes("picture") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".gif") ||
      lowerName.endsWith(".webp")
    );
  }

  function autoCreateFields() {
    console.log("autoCreateFields called with:", availableFields);

    if (!availableFields || availableFields.length === 0) {
      console.log("No available fields to create, aborting");
      return;
    }

    // Clear existing layers first
    layerActions.clearLayers();

    const textFields = [];
    const imageFields = [];

    availableFields.forEach((field, index) => {
      if (isImageColumn(field)) {
        // Create image field (put images at bottom z-index)
        imageFields.push({
          id: Date.now() + index,
          x: 50,
          y: 50 + index * 80,
          width: 100,
          height: 100,
          staticImage: null,
          mappedColumn: field,
          imagePath: imageBasePath,
        });
      } else {
        // Create text field (put text fields on top)
        textFields.push({
          id: Date.now() + index + 1000,
          x: 50,
          y: 50 + index * 40,
          width: 200,
          height: 30,
          text: field,
          fontSize: 14,
          fontFamily: "Arial",
          color: "#000000",
          alignment: "left",
          mappedColumn: field,
        });
      }
    });

    console.log("Created fields:", { textFields, imageFields });

    // Initialize layers in the store
    layerActions.initializeLayers(textFields, imageFields);

    // Force component update by updating cardTemplate
    cardTemplate.textFields = textFields;
    cardTemplate.imageFields = imageFields;
    cardTemplate = { ...cardTemplate };

    console.log(
      "Auto-created",
      textFields.length + imageFields.length,
      "fields",
    );
    console.log("Layers store now contains:", $layersStore);
  }

  function addTextField() {
    const newField = {
      id: Date.now(),
      x: 50,
      y: 50,
      width: 100,
      height: 30,
      text: "New Text Field",
      fontSize: 14,
      fontFamily: "Arial",
      color: "#000000",
      alignment: "left",
      mappedColumn: null,
    };

    layerActions.addLayer("text", newField);
    selectedField = newField;
  }

  function addImageField() {
    const newField = {
      id: Date.now(),
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      staticImage: null,
      mappedColumn: null,
      imagePath: imageBasePath,
    };

    layerActions.addLayer("image", newField);
    selectedField = newField;
  }

  function deleteField(fieldId) {
    layerActions.removeLayer(fieldId);
    if (selectedField && selectedField.id === fieldId) {
      selectedField = null;
    }
  }

  function onFieldMouseDown(event, field) {
    selectedField = field;
    draggedField = field;

    const startX = event.clientX - field.x;
    const startY = event.clientY - field.y;

    function onMouseMove(e) {
      if (draggedField) {
        const newX = e.clientX - startX;
        const newY = e.clientY - startY;

        // Keep within card bounds
        const boundedX = Math.max(
          0,
          Math.min(cardTemplate.width - draggedField.width, newX),
        );
        const boundedY = Math.max(
          0,
          Math.min(cardTemplate.height - draggedField.height, newY),
        );

        // Update the layer in the store
        layerActions.updateLayer(draggedField.id, {
          x: boundedX,
          y: boundedY,
        });
      }
    }

    function onMouseUp() {
      draggedField = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function updateSelectedField() {
    cardTemplate = { ...cardTemplate };
    dispatch("template-updated", cardTemplate);
  }

  function exportTemplate() {
    dispatch("template-exported", cardTemplate);
  }

  async function handleBackgroundImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Set card dimensions based on background image
          cardTemplate.width = img.width;
          cardTemplate.height = img.height;
          cardTemplate.backgroundImage = e.target.result;
          cardTemplate = { ...cardTemplate };
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleOverlayImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        cardTemplate.overlayImage = e.target.result;
        cardTemplate = { ...cardTemplate };
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleStaticImageUpload(event) {
    const file = event.target.files[0];
    if (
      file &&
      file.type.startsWith("image/") &&
      selectedField &&
      selectedField.type === "image"
    ) {
      const reader = new FileReader();
      reader.onload = (e) => {
        layerActions.updateLayer(selectedField.id, {
          staticImage: e.target.result,
        });
      };
      reader.readAsDataURL(file);
    }
  }

  function removeBackgroundImage() {
    cardTemplate.backgroundImage = null;
    cardTemplate = { ...cardTemplate };
    backgroundImageFile = null;
  }

  function removeOverlayImage() {
    cardTemplate.overlayImage = null;
    cardTemplate = { ...cardTemplate };
    overlayImageFile = null;
  }

  async function handleFolderSelection(event) {
    const files = event.target.files;
    if (files.length > 0) {
      localImageFiles.clear();

      // Get the first file and extract the directory path
      const filePath = files[0].webkitRelativePath || files[0].name;
      const pathParts = filePath.split("/");

      if (pathParts.length > 1) {
        // Remove the filename to get the folder path
        pathParts.pop();
        imageBasePath = pathParts.join("/") + "/";
      } else {
        imageBasePath = "";
      }

      // Load all image files into memory as data URLs
      const imageLoadPromises = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              // Get just the filename from the relative path
              const fileName = file.webkitRelativePath
                ? file.webkitRelativePath.split("/").pop()
                : file.name;
              localImageFiles.set(fileName.toLowerCase(), e.target.result);
              resolve();
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          imageLoadPromises.push(promise);
        }
      }

      try {
        await Promise.all(imageLoadPromises);
        console.log(`Loaded ${localImageFiles.size} images from local folder`);

        // Update all existing image fields to use the new base path
        cardTemplate.imageFields.forEach((field) => {
          field.imagePath = imageBasePath;
        });

        cardTemplate = { ...cardTemplate };

        // Dispatch the updated local images to parent component
        dispatch("local-images-updated", localImageFiles);
      } catch (error) {
        console.error("Error loading images:", error);
        alert("Error loading some images from the selected folder.");
      }
    }
  }

  // Function to resolve image paths for both local and web usage
  function resolveImageSrc(field, rowData) {
    if (field.staticImage) {
      return field.staticImage;
    }

    if (field.mappedColumn && rowData && rowData[field.mappedColumn]) {
      const imageName = rowData[field.mappedColumn];

      // First try to find in local loaded images (case-insensitive)
      const localImage = localImageFiles.get(imageName.toLowerCase());
      if (localImage) {
        return localImage;
      }

      // Fallback to constructing path (for web/relative paths)
      return field.imagePath + imageName;
    }

    return null;
  }

  function onResizeMouseDown(event, field) {
    event.stopPropagation();
    resizingField = field;

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = field.width;
    const startHeight = field.height;

    function onMouseMove(e) {
      if (resizingField) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newWidth = Math.max(
          20,
          Math.min(cardTemplate.width - resizingField.x, startWidth + deltaX),
        );
        const newHeight = Math.max(
          10,
          Math.min(cardTemplate.height - resizingField.y, startHeight + deltaY),
        );

        // Update the layer in the store to ensure proper reactivity
        layerActions.updateLayer(resizingField.id, {
          width: newWidth,
          height: newHeight,
        });
      }
    }

    function onMouseUp() {
      resizingField = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function loadDefaultTemplate() {
    cardTemplate.backgroundImage =
      "/src/lib/assets/card_backgrounds/spielkarte_bg.jpg";
    cardTemplate.width = 400;
    cardTemplate.height = 600;
    cardTemplate = { ...cardTemplate };
  }

  function getFieldZIndex(field) {
    const layerIndex = layers.findIndex((l) => l.id === field.id);
    // Use array index as z-index (0 = back, higher = front)
    // Add base offset to ensure positive z-index values
    return layerIndex !== -1 ? layerIndex + 10 : 10;
  }

  $: dispatch("template-updated", cardTemplate);
</script>

<div class="card-designer">
  <div class="designer-header">
    <h2>Card Template Designer</h2>
    <div class="controls">
      <button on:click={loadDefaultTemplate} class="btn btn-secondary"
        >Load Default Template</button
      >
      <button on:click={addTextField} class="btn btn-primary"
        >Add Text Field</button
      >
      <button on:click={addImageField} class="btn btn-primary"
        >Add Image Field</button
      >
      <button on:click={exportTemplate} class="btn btn-secondary"
        >Export Template</button
      >
    </div>
  </div>

  <div class="designer-content">
    <!-- Left sidebar with settings -->
    <div class="sidebar">
      <div class="sidebar-section">
        <h3>Card Settings</h3>
        <div class="setting-group">
          <label for="card-width">Width (px):</label>
          <input
            id="card-width"
            type="number"
            bind:value={cardTemplate.width}
            min="100"
            max="800"
          />
        </div>
        <div class="setting-group">
          <label for="card-height">Height (px):</label>
          <input
            id="card-height"
            type="number"
            bind:value={cardTemplate.height}
            min="100"
            max="600"
          />
        </div>
        <div class="setting-group">
          <label for="card-bg-color">Background Color:</label>
          <input
            id="card-bg-color"
            type="color"
            bind:value={cardTemplate.backgroundColor}
          />
        </div>
        <div class="setting-group">
          <label for="card-border-color">Border Color:</label>
          <input
            id="card-border-color"
            type="color"
            bind:value={cardTemplate.borderColor}
          />
        </div>
        <div class="setting-group">
          <label for="card-border-width">Border Width (px):</label>
          <input
            id="card-border-width"
            type="number"
            bind:value={cardTemplate.borderWidth}
            min="0"
            max="10"
          />
        </div>

        <h4>Images</h4>
        <div class="setting-group">
          <label for="background-image">Background Image:</label>
          <input
            id="background-image"
            type="file"
            accept="image/*"
            on:change={handleBackgroundImageUpload}
            bind:this={backgroundImageFile}
          />
          {#if cardTemplate.backgroundImage}
            <button
              on:click={removeBackgroundImage}
              class="btn btn-small btn-danger">Remove Background</button
            >
          {/if}
        </div>

        <div class="setting-group">
          <label for="overlay-image">Overlay Image:</label>
          <input
            id="overlay-image"
            type="file"
            accept="image/*"
            on:change={handleOverlayImageUpload}
            bind:this={overlayImageFile}
          />
          {#if cardTemplate.overlayImage}
            <button
              on:click={removeOverlayImage}
              class="btn btn-small btn-danger">Remove Overlay</button
            >
          {/if}
        </div>

        <div class="setting-group">
          <label for="image-base-path">Image Base Path:</label>
          <div class="path-input-group">
            <input
              id="image-base-path"
              type="text"
              bind:value={imageBasePath}
              placeholder="./assets/images/"
            />
            <input
              id="folder-selector"
              type="file"
              webkitdirectory
              multiple
              on:change={handleFolderSelection}
              style="display: none;"
            />
            <button
              type="button"
              class="btn btn-small btn-secondary"
              on:click={() =>
                document.getElementById("folder-selector").click()}
            >
              📁 Browse
            </button>
          </div>
          <small
            >Path where mapped image files are located. Use Browse to select a
            folder.</small
          >
        </div>
      </div>

      <!-- Layer Overview -->
      {#if layers.length > 0}
        <div class="sidebar-section">
          <h3>Layers</h3>
          <div class="layers-list">
            {#each layers.slice().reverse() as layer, displayIndex (layer.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="layer-item {selectedField?.id === layer.id
                  ? 'selected'
                  : ''}"
                on:click={() => (selectedField = layer)}
              >
                <div class="layer-icon">
                  {#if layer.type === "text"}
                    <span class="text-icon">T</span>
                  {:else}
                    <span class="image-icon">🖼</span>
                  {/if}
                </div>
                <div class="layer-name">{layer.name}</div>
                <div class="layer-controls">
                  <button
                    class="layer-btn"
                    on:click|stopPropagation={() =>
                      layerActions.moveLayerUp(layer.id)}
                    disabled={!layerActions.canMoveUp(layers, layer.id)}
                    title="Move layer to front"
                  >
                    ↑
                  </button>
                  <button
                    class="layer-btn"
                    on:click|stopPropagation={() =>
                      layerActions.moveLayerDown(layer.id)}
                    disabled={!layerActions.canMoveDown(layers, layer.id)}
                    title="Move layer to back"
                  >
                    ↓
                  </button>
                </div>
              </div>
            {/each}
          </div>
          <small class="layer-hint"
            >Front layers at top. Use ↑ to move forward, ↓ to move backward.</small
          >
        </div>
      {/if}
    </div>

    <!-- Main content area with card preview -->
    <div class="card-preview-area">
      <h3>Card Preview</h3>
      <div class="preview-container">
        <div
          class="card"
          style="
            width: {cardTemplate.width}px;
            height: {cardTemplate.height}px;
            background-color: {cardTemplate.backgroundColor};
            border: {cardTemplate.borderWidth}px solid {cardTemplate.borderColor};
            {cardTemplate.backgroundImage
            ? `background-image: url(${cardTemplate.backgroundImage}); background-size: cover; background-position: center;`
            : ''}
          "
        >
          {#if cardTemplate.overlayImage}
            <img
              src={cardTemplate.overlayImage}
              alt="Overlay"
              class="overlay-image"
              style="
                width: {cardTemplate.width}px;
                height: {cardTemplate.height}px;
              "
            />
          {/if}

          {#each layers as layer (layer.id)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="{layer.type}-field {selectedField?.id === layer.id
                ? 'selected'
                : ''}"
              style="
                left: {layer.x}px;
                top: {layer.y}px;
                width: {layer.width}px;
                height: {layer.height}px;
                {layer.type === 'text'
                ? `
                  font-size: ${layer.fontSize}px;
                  font-family: ${layer.fontFamily};
                  color: ${layer.color};
                  text-align: ${layer.alignment};
                `
                : ''}
                z-index: {getFieldZIndex(layer)};
              "
              on:mousedown={(e) => onFieldMouseDown(e, layer)}
            >
              {#if layer.type === "text"}
                {layer.mappedColumn || layer.text}
              {:else if layer.type === "image"}
                {#if layer.staticImage}
                  <img
                    src={layer.staticImage}
                    alt="Static"
                    class="field-image"
                  />
                {:else}
                  {@const imageSrc = resolveImageSrc(layer, {})}
                  {#if imageSrc && layer.mappedColumn}
                    <img src={imageSrc} alt="Preview" class="field-image" />
                  {:else if layer.mappedColumn}
                    <div class="image-placeholder">
                      {layer.mappedColumn}
                    </div>
                  {:else}
                    <div class="image-placeholder">Image Field</div>
                  {/if}
                {/if}
              {/if}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="resize-handle"
                on:mousedown={(e) => onResizeMouseDown(e, layer)}
              ></div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right toolbar for field settings -->
    <div class="toolbar">
      {#if selectedField && selectedField.type === "text"}
        <div class="toolbar-section">
          <h3>Text Field Settings</h3>
          <div class="setting-group">
            <label for="field-text">Text:</label>
            <input
              id="field-text"
              type="text"
              bind:value={selectedField.text}
              on:input={updateSelectedField}
            />
          </div>

          <div class="setting-group">
            <label for="field-mapping">Map to Column:</label>
            <select
              id="field-mapping"
              bind:value={selectedField.mappedColumn}
              on:change={updateSelectedField}
            >
              <option value={null}>No mapping</option>
              {#each availableFields as field}
                <option value={field}>{field}</option>
              {/each}
            </select>
          </div>

          <div class="setting-group">
            <label for="field-font-size">Font Size:</label>
            <input
              id="field-font-size"
              type="number"
              bind:value={selectedField.fontSize}
              min="8"
              max="72"
              on:input={updateSelectedField}
            />
          </div>

          <div class="setting-group">
            <label for="field-font-family">Font Family:</label>
            <select
              id="field-font-family"
              bind:value={selectedField.fontFamily}
              on:change={updateSelectedField}
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Verdana">Verdana</option>
            </select>
          </div>

          <div class="setting-group">
            <label for="field-color">Color:</label>
            <input
              id="field-color"
              type="color"
              bind:value={selectedField.color}
              on:input={updateSelectedField}
            />
          </div>

          <div class="setting-group">
            <label for="field-alignment">Alignment:</label>
            <select
              id="field-alignment"
              bind:value={selectedField.alignment}
              on:change={updateSelectedField}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <div class="setting-group">
            <label for="field-width">Width:</label>
            <input
              id="field-width"
              type="number"
              bind:value={selectedField.width}
              min="10"
              max="500"
              on:input={updateSelectedField}
            />
          </div>

          <div class="setting-group">
            <label for="field-height">Height:</label>
            <input
              id="field-height"
              type="number"
              bind:value={selectedField.height}
              min="10"
              max="200"
              on:input={updateSelectedField}
            />
          </div>

          <button
            on:click={() => deleteField(selectedField.id)}
            class="btn btn-danger delete-field-btn"
          >
            Delete Text Field
          </button>
        </div>
      {:else if selectedField && selectedField.type === "image"}
        <div class="toolbar-section">
          <h3>Image Field Settings</h3>

          <div class="setting-group">
            <label for="static-image">Static Image:</label>
            <input
              id="static-image"
              type="file"
              accept="image/*"
              on:change={handleStaticImageUpload}
            />
            {#if selectedField.staticImage}
              <button
                on:click={() => {
                  selectedField.staticImage = null;
                  updateSelectedField();
                }}
                class="btn btn-small btn-danger">Remove Image</button
              >
            {/if}
          </div>

          <div class="setting-group">
            <label for="image-mapping">Map to Column:</label>
            <select
              id="image-mapping"
              bind:value={selectedField.mappedColumn}
              on:change={updateSelectedField}
            >
              <option value={null}>No mapping</option>
              {#each availableFields as field}
                <option value={field}>{field}</option>
              {/each}
            </select>
          </div>

          <div class="setting-group">
            <label for="image-width">Width:</label>
            <input
              id="image-width"
              type="number"
              bind:value={selectedField.width}
              min="10"
              max="500"
              on:input={updateSelectedField}
            />
          </div>

          <div class="setting-group">
            <label for="image-height">Height:</label>
            <input
              id="image-height"
              type="number"
              bind:value={selectedField.height}
              min="10"
              max="500"
              on:input={updateSelectedField}
            />
          </div>

          <button
            on:click={() => deleteField(selectedField.id)}
            class="btn btn-danger delete-field-btn"
          >
            Delete Image Field
          </button>
        </div>
      {:else}
        <div class="toolbar-section">
          <div class="no-selection">
            <h3>Field Settings</h3>
            <p>Select a text or image field to edit its properties</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .card-designer {
    padding: 20px;
  }

  .designer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .controls {
    display: flex;
    gap: 10px;
  }

  .designer-content {
    display: grid;
    grid-template-columns: 300px 1fr 320px;
    gap: 20px;
    height: calc(100vh - 200px);
  }

  .sidebar {
    background: #f9f9f9;
    border-radius: 8px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
  }

  .toolbar {
    background: #f9f9f9;
    border-radius: 8px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
  }

  .sidebar-section {
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .sidebar-section:last-child {
    border-bottom: none;
  }

  .sidebar-section h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 16px;
  }

  .sidebar-section h4 {
    margin: 20px 0 10px 0;
    color: #666;
    font-size: 14px;
  }

  .toolbar-section {
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
  }

  .toolbar-section:last-child {
    border-bottom: none;
  }

  .toolbar-section h3 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 16px;
  }

  .toolbar-section .no-selection h3 {
    margin-bottom: 10px;
  }

  .toolbar-section .no-selection p {
    margin: 0;
    color: #999;
    font-style: italic;
    font-size: 14px;
  }

  .setting-group {
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .setting-group label {
    font-weight: bold;
    font-size: 13px;
    color: #555;
  }

  .setting-group input,
  .setting-group select {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .setting-group small {
    color: #666;
    font-size: 11px;
  }

  .card-preview-area {
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    overflow: hidden;
  }

  .card-preview-area h3 {
    margin: 0;
    padding: 20px;
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
  }

  .preview-container {
    flex: 1;
    padding: 20px;
    overflow: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }

  .card {
    position: relative;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    flex-shrink: 0;
  }

  .text-field {
    position: absolute;
    cursor: move;
    border: 1px dashed transparent;
    display: flex;
    align-items: center;
    padding: 2px;
    box-sizing: border-box;
    overflow: hidden;
    z-index: 10;
  }

  .text-field:hover {
    border-color: #007cba;
    background: rgba(0, 124, 186, 0.05);
  }

  .text-field.selected {
    border-color: #007cba;
    background: rgba(0, 124, 186, 0.1);
  }

  .image-field {
    position: absolute;
    cursor: move;
    border: 1px dashed transparent;
    box-sizing: border-box;
    overflow: hidden;
    z-index: 10;
  }

  .image-field:hover {
    border-color: #28a745;
    background: rgba(40, 167, 69, 0.05);
  }

  .image-field.selected {
    border-color: #28a745;
    background: rgba(40, 167, 69, 0.1);
  }

  .field-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
  }

  .image-placeholder {
    width: 100%;
    height: 100%;
    background: #f0f0f0;
    border: 2px dashed #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: #666;
    text-align: center;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-primary {
    background: #007cba;
    color: white;
  }

  .btn-secondary {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
  }

  .btn-small {
    padding: 5px 10px;
    font-size: 12px;
    margin-top: 5px;
  }

  .btn-danger {
    background: #d32f2f;
    color: white;
  }

  .btn-danger:hover {
    background: #b71c1c;
  }

  .delete-field-btn {
    width: 100%;
    margin-top: 20px;
  }

  .resize-handle {
    position: absolute;
    bottom: -5px;
    right: -5px;
    width: 10px;
    height: 10px;
    background: #007cba;
    cursor: se-resize;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .text-field:hover .resize-handle,
  .text-field.selected .resize-handle,
  .image-field:hover .resize-handle,
  .image-field.selected .resize-handle {
    opacity: 1;
  }

  .image-field .resize-handle {
    background: #28a745;
  }

  .overlay-image {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    object-fit: cover;
    z-index: 1;
  }

  .no-selection {
    color: #999;
    font-style: italic;
    text-align: center;
    padding: 40px 20px;
  }

  /* Layer Overview Styles */
  .layers-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }

  .layer-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
  }

  .layer-item:hover {
    background: #f8f9fa;
    border-color: #007cba;
  }

  .layer-item.selected {
    background: #e3f2fd;
    border-color: #007cba;
    box-shadow: 0 0 0 1px rgba(0, 124, 186, 0.2);
  }

  .layer-item.drag-target {
    background: #fff3cd;
    border-color: #ffc107;
    transform: translateY(-2px);
  }

  .layer-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    font-weight: bold;
    font-size: 12px;
  }

  .text-icon {
    background: #007cba;
    color: white;
    padding: 4px 6px;
    border-radius: 3px;
  }

  .image-icon {
    font-size: 14px;
  }

  .layer-name {
    flex: 1;
    font-size: 13px;
    color: #333;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drag-handle {
    color: #999;
    font-size: 14px;
    cursor: grab;
    padding: 2px;
    line-height: 1;
  }

  .drag-handle:hover {
    color: #666;
  }

  .layer-hint {
    color: #666;
    font-size: 11px;
    font-style: italic;
    margin-top: 5px;
    display: block;
  }

  .path-input-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .path-input-group input[type="text"] {
    flex: 1;
    min-width: 0;
  }

  .path-input-group .btn {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .drop-indicator {
    height: 2px;
    background: #007cba;
    margin: 4px 0;
    border-radius: 1px;
    box-shadow: 0 0 4px rgba(0, 124, 186, 0.4);
  }

  .layer-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .layer-btn {
    width: 20px;
    height: 20px;
    border: 1px solid #ddd;
    border-radius: 3px;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .layer-btn:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #007cba;
    color: #007cba;
  }

  .layer-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .layer-btn:active:not(:disabled) {
    background: #e3f2fd;
    transform: scale(0.95);
  }
</style>
