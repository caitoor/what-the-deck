<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let cardTemplate;
  export let data = [];
  export let localImageFiles = new Map(); // Pass local image files from parent
  
  let generatedCards = [];
  let exportFormat = 'pdf';
  let exporting = false;
  let exportProgress = 0;
  
  $: if (cardTemplate && data.length > 0) {
    generateCardPreviews();
  }
  
  function generateCardPreviews() {
    generatedCards = data.slice(0, 20).map((row, index) => {
      const card = {
        id: index,
        data: row,
        template: cardTemplate
      };
      return card;
    });
  }
  
  function renderCardText(field, rowData) {
    if (field.mappedColumn && rowData[field.mappedColumn]) {
      return rowData[field.mappedColumn];
    }
    return field.text;
  }

  function renderImageSrc(field, rowData) {
    if (field.staticImage) {
      return field.staticImage;
    }
    if (field.mappedColumn && rowData && rowData[field.mappedColumn]) {
      const imageName = rowData[field.mappedColumn];
      // First try local loaded images (case-insensitive)
      const localImage = localImageFiles.get(imageName.toLowerCase());
      if (localImage) {
        return localImage;
      }
      // Fallback to web path
      return field.imagePath + imageName;
    }
    return null;
  }
  
  async function exportCards() {
    exporting = true;
    exportProgress = 0;
    
    try {
      if (exportFormat === 'pdf') {
        await exportAsPDF();
      } else if (exportFormat === 'jpg') {
        await exportAsImages();
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    } finally {
      exporting = false;
    }
  }
  
  async function exportAsPDF() {
    // Import jsPDF dynamically
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    
    // Use A4 page size and calculate layout
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10; // 10mm margin
    
    // Convert card dimensions from px to mm (assuming 96 DPI)
    const cardWidthMM = (cardTemplate.width * 25.4) / 96;
    const cardHeightMM = (cardTemplate.height * 25.4) / 96;
    
    // Calculate how many cards fit per row/column
    const cardsPerRow = Math.floor((pageWidth - 2 * margin) / (cardWidthMM + 5));
    const cardsPerCol = Math.floor((pageHeight - 2 * margin) / (cardHeightMM + 5));
    const cardsPerPage = cardsPerRow * cardsPerCol;
    
    // Ensure at least 1 card per page
    const safeCardsPerPage = Math.max(1, cardsPerPage);
    
    for (let i = 0; i < data.length; i++) {
      exportProgress = Math.round((i / data.length) * 100);
      
      // Add new page if needed (except for first card)
      if (i > 0 && i % safeCardsPerPage === 0) {
        pdf.addPage();
      }
      
      // Create temporary card element
      const cardElement = createCardElement(data[i]);
      document.body.appendChild(cardElement);
      
      try {
        const canvas = await html2canvas(cardElement, {
          width: cardTemplate.width,
          height: cardTemplate.height,
          scale: 2,
          backgroundColor: cardTemplate.backgroundColor
        });
        
        // Calculate position on current page
        const cardIndex = i % safeCardsPerPage;
        const row = Math.floor(cardIndex / cardsPerRow);
        const col = cardIndex % cardsPerRow;
        
        const x = margin + col * (cardWidthMM + 5);
        const y = margin + row * (cardHeightMM + 5);
        
        // Ensure coordinates are valid
        if (x >= 0 && y >= 0 && x + cardWidthMM <= pageWidth && y + cardHeightMM <= pageHeight) {
          pdf.addImage(
            canvas.toDataURL('image/png'), 
            'PNG', 
            x, 
            y, 
            cardWidthMM, 
            cardHeightMM
          );
        }
      } finally {
        document.body.removeChild(cardElement);
      }
    }
    
    pdf.save('cards.pdf');
    exportProgress = 100;
  }
  
  async function exportAsImages() {
    const html2canvas = (await import('html2canvas')).default;
    const zip = new (await import('jszip')).default();
    
    for (let i = 0; i < data.length; i++) {
      exportProgress = Math.round((i / data.length) * 100);
      
      const cardElement = createCardElement(data[i]);
      document.body.appendChild(cardElement);
      
      try {
        const canvas = await html2canvas(cardElement, {
          width: cardTemplate.width,
          height: cardTemplate.height,
          scale: 2
        });
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        zip.file(`card_${i + 1}.jpg`, imageData, { base64: true });
      } finally {
        document.body.removeChild(cardElement);
      }
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cards.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    exportProgress = 100;
  }
  
  function createCardElement(rowData) {
    const cardDiv = document.createElement('div');
    
    // Set base card styles
    let cardStyles = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: ${cardTemplate.width}px;
      height: ${cardTemplate.height}px;
      background-color: ${cardTemplate.backgroundColor};
      border: ${cardTemplate.borderWidth}px solid ${cardTemplate.borderColor};
      box-sizing: border-box;
    `;
    
    // Add background image if present
    if (cardTemplate.backgroundImage) {
      cardStyles += `
        background-image: url(${cardTemplate.backgroundImage});
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
      `;
    }
    
    cardDiv.style.cssText = cardStyles;
    
    // Add overlay image if present
    if (cardTemplate.overlayImage) {
      const overlayImg = document.createElement('img');
      overlayImg.src = cardTemplate.overlayImage;
      overlayImg.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: ${cardTemplate.width}px;
        height: ${cardTemplate.height}px;
        object-fit: cover;
        pointer-events: none;
        z-index: 1;
      `;
      cardDiv.appendChild(overlayImg);
    }
    
    // Add text fields
    if (cardTemplate.textFields) {
      cardTemplate.textFields.forEach(field => {
        const textDiv = document.createElement('div');
        textDiv.style.cssText = `
          position: absolute;
          left: ${field.x}px;
          top: ${field.y}px;
          width: ${field.width}px;
          height: ${field.height}px;
          font-size: ${field.fontSize}px;
          font-family: ${field.fontFamily};
          color: ${field.color};
          text-align: ${field.alignment};
          display: flex;
          align-items: center;
          padding: 2px;
          box-sizing: border-box;
          overflow: hidden;
          z-index: 2;
        `;
        textDiv.textContent = renderCardText(field, rowData);
        cardDiv.appendChild(textDiv);
      });
    }

    // Add image fields
    if (cardTemplate.imageFields) {
      cardTemplate.imageFields.forEach(field => {
        const imageSrc = renderImageSrc(field, rowData);
        if (imageSrc) {
          const imgElement = document.createElement('img');
          imgElement.src = imageSrc;
          imgElement.style.cssText = `
            position: absolute;
            left: ${field.x}px;
            top: ${field.y}px;
            width: ${field.width}px;
            height: ${field.height}px;
            object-fit: cover;
            z-index: 2;
          `;
          cardDiv.appendChild(imgElement);
        }
      });
    }
    
    return cardDiv;
  }
</script>

<div class="card-generator">
  <div class="generator-header">
    <h2>Generate Cards</h2>
    <div class="export-controls">
      <select bind:value={exportFormat} class="format-select">
        <option value="pdf">Export as PDF</option>
        <option value="jpg">Export as JPG (ZIP)</option>
      </select>
      <button 
        on:click={exportCards} 
        disabled={exporting || !cardTemplate || data.length === 0}
        class="btn btn-primary"
      >
        {exporting ? `Exporting... ${exportProgress}%` : `Export ${data.length} Cards`}
      </button>
    </div>
  </div>
  
  {#if exporting}
    <div class="progress-bar">
      <div class="progress-fill" style="width: {exportProgress}%"></div>
    </div>
  {/if}
  
  {#if generatedCards.length > 0}
    <div class="cards-preview">
      <h3>Card Preview ({data.length} total cards)</h3>
      <p class="preview-note">Showing first {Math.min(20, data.length)} cards</p>
      
      <div class="cards-grid">
        {#each generatedCards as card (card.id)}
          <div 
            class="card-preview"
            style="
              --card-aspect-ratio: {cardTemplate.width / cardTemplate.height};
              width: {Math.min(cardTemplate.width * 0.5, 300)}px;
              height: {Math.min(cardTemplate.height * 0.5, 400)}px;
              background-color: {cardTemplate.backgroundColor};
              border: {cardTemplate.borderWidth * 0.5}px solid {cardTemplate.borderColor};
              {cardTemplate.backgroundImage ? `background-image: url(${cardTemplate.backgroundImage}); background-size: cover; background-position: center;` : ''}
            "
          >
            {#if cardTemplate.overlayImage}
              <img 
                src={cardTemplate.overlayImage} 
                alt="Overlay" 
                class="preview-overlay-image"
                style="
                  width: {cardTemplate.width * 0.5}px;
                  height: {cardTemplate.height * 0.5}px;
                "
              />
            {/if}
            
            {#each cardTemplate.textFields as field}
              <div
                class="preview-text"
                style="
                  left: {field.x * 0.5}px;
                  top: {field.y * 0.5}px;
                  width: {field.width * 0.5}px;
                  height: {field.height * 0.5}px;
                  font-size: {field.fontSize * 0.5}px;
                  font-family: {field.fontFamily};
                  color: {field.color};
                  text-align: {field.alignment};
                "
              >
                {renderCardText(field, card.data)}
              </div>
            {/each}

            {#each (cardTemplate.imageFields || []) as field}
              <div
                class="preview-image"
                style="
                  left: {field.x * 0.5}px;
                  top: {field.y * 0.5}px;
                  width: {field.width * 0.5}px;
                  height: {field.height * 0.5}px;
                "
              >
                {#if renderImageSrc(field, card.data)}
                  <img 
                    src={renderImageSrc(field, card.data)} 
                    alt="Card Image"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  />
                {:else}
                  <div class="image-placeholder-preview">
                    {field.mappedColumn || 'Image'}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {:else if cardTemplate && data.length === 0}
    <div class="no-data">
      <p>No data available. Please import data first.</p>
    </div>
  {:else if !cardTemplate}
    <div class="no-template">
      <p>No card template available. Please create a template first.</p>
    </div>
  {/if}
</div>

<style>
  .card-generator {
    padding: 20px;
  }
  
  .generator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .export-controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .format-select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
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
  
  .btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .progress-bar {
    width: 100%;
    height: 20px;
    background: #f0f0f0;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  
  .progress-fill {
    height: 100%;
    background: #007cba;
    transition: width 0.3s ease;
  }
  
  .cards-preview {
    margin-top: 20px;
  }
  
  .preview-note {
    color: #666;
    font-style: italic;
    margin-bottom: 15px;
  }
  
  .cards-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    max-height: 70vh;
    overflow-y: auto;
    padding: 20px;
    border: 1px solid #eee;
    border-radius: 8px;
    justify-content: flex-start;
    align-items: flex-start;
    align-content: flex-start;
    /* Ensure proper flex behavior */
    box-sizing: border-box;
  }
  
  .card-preview {
    position: relative;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border-radius: 4px;
    flex-shrink: 0;
    flex-grow: 0;
    /* Responsive sizing with proper constraints */
    max-width: min(250px, 25vw);
    max-height: min(350px, 35vh);
    /* Maintain aspect ratio while respecting max constraints */
    aspect-ratio: var(--card-aspect-ratio);
    /* Ensure cards scale proportionally but don't exceed limits */
    width: clamp(150px, 20vw, 250px);
    height: auto;
    box-sizing: border-box;
  }
  
  @media (max-width: 768px) {
    .cards-grid {
      justify-content: center;
      gap: 15px;
    }
    
    .card-preview {
      max-width: min(200px, 40vw);
      max-height: min(280px, 45vh);
    }
  }
  
  @media (min-width: 1200px) {
    .cards-grid {
      justify-content: flex-start;
    }
    
    .card-preview {
      max-width: min(300px, 20vw);
      max-height: min(400px, 30vh);
    }
  }
  
  .preview-text {
    position: absolute;
    display: flex;
    align-items: center;
    padding: 1px;
    box-sizing: border-box;
    overflow: hidden;
    word-break: break-word;
    z-index: 2;
  }
  
  .preview-overlay-image {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    object-fit: cover;
    z-index: 1;
  }
  
  .preview-image {
    position: absolute;
    z-index: 2;
  }
  
  .image-placeholder-preview {
    width: 100%;
    height: 100%;
    background: #f0f0f0;
    border: 1px dashed #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    text-align: center;
  }
  
  .no-data, .no-template {
    text-align: center;
    padding: 40px;
    color: #666;
    font-style: italic;
  }
</style>
