<script>
  import GoogleSheetsImporter from '$lib/components/GoogleSheetsImporter.svelte';
  import CardTemplateDesigner from '$lib/components/CardTemplateDesigner.svelte';
  import CardGenerator from '$lib/components/CardGenerator.svelte';
  
  let currentStep = 1;
  let importedData = null;
  let cardTemplate = null;
  let availableFields = [];
  let localImageFiles = new Map(); // Store local image files loaded in template designer
  
  function handleDataImported(event) {
    importedData = event.detail.data;
    availableFields = importedData.headers || [];
    currentStep = 2;
  }
  
  function handleTemplateUpdated(event) {
    cardTemplate = event.detail;
    // Don't automatically switch steps - let user stay in template designer
  }
  
  function handleLocalImagesUpdated(event) {
    localImageFiles = event.detail;
  }
  
  function goToStep(step) {
    if (step === 1 || (step === 2 && importedData) || (step === 3 && importedData && cardTemplate)) {
      currentStep = step;
    }
  }
  
  function resetApp() {
    currentStep = 1;
    importedData = null;
    cardTemplate = null;
    availableFields = [];
  }
</script>

<svelte:head>
  <title>What The Deck - Card Generator</title>
  <meta name="description" content="Create custom card decks from Google Sheets data" />
</svelte:head>

<div class="app">
  <header class="app-header">
    <h1>What The Deck</h1>
    <p>Create custom card decks from your Google Sheets data</p>
    <button on:click={resetApp} class="reset-btn">Start Over</button>
  </header>
  
  <nav class="step-navigation">
    <button 
      class="step-btn {currentStep === 1 ? 'active' : ''}"
      on:click={() => goToStep(1)}
    >
      <span class="step-number">1</span>
      Import Data
    </button>
    <button 
      class="step-btn {currentStep === 2 ? 'active' : ''} {!importedData ? 'disabled' : ''}"
      on:click={() => goToStep(2)}
      disabled={!importedData}
    >
      <span class="step-number">2</span>
      Design Template
    </button>
    <button 
      class="step-btn {currentStep === 3 ? 'active' : ''} {!importedData || !cardTemplate ? 'disabled' : ''}"
      on:click={() => goToStep(3)}
      disabled={!importedData || !cardTemplate}
    >
      <span class="step-number">3</span>
      Generate Cards
    </button>
  </nav>
  
  <main class="app-content">
    {#if currentStep === 1}
      <div class="step-content">
        <GoogleSheetsImporter on:data-imported={handleDataImported} />
        
        {#if importedData}
          <div class="success-message">
            <h3>✅ Data imported successfully!</h3>
            <p>
              Imported {importedData.data.length} rows with columns: 
              {importedData.headers.join(', ')}
            </p>
            <button on:click={() => goToStep(2)} class="btn btn-primary">
              Continue to Template Design →
            </button>
          </div>
        {/if}
      </div>
    {/if}
    
    {#if currentStep === 2}
      <div class="step-content">
        <CardTemplateDesigner 
          {availableFields}
          on:template-updated={handleTemplateUpdated}
          on:local-images-updated={handleLocalImagesUpdated}
        />
        
        {#if cardTemplate && cardTemplate.textFields.length > 0}
          <div class="success-message">
            <h3>✅ Template created successfully!</h3>
            <p>
              Your template has {cardTemplate.textFields.length} text field(s).
              Ready to generate cards!
            </p>
            <button on:click={() => goToStep(3)} class="btn btn-primary">
              Continue to Card Generation →
            </button>
          </div>
        {/if}
      </div>
    {/if}
    
    {#if currentStep === 3}
      <div class="step-content">
        <CardGenerator 
          {cardTemplate}
          data={importedData?.data || []}
          {localImageFiles}
        />
      </div>
    {/if}
  </main>
  
  <footer class="app-footer">
    <p>
      Built with SvelteKit • 
      <a href="https://github.com" target="_blank" rel="noopener">View Source</a>
    </p>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa;
    color: #333;
  }
  
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .app-header {
    background: linear-gradient(135deg, #007cba 0%, #005a87 100%);
    color: white;
    padding: 30px 20px;
    text-align: center;
    position: relative;
  }
  
  .app-header h1 {
    margin: 0;
    font-size: 2.5rem;
    font-weight: 700;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  
  .app-header p {
    margin: 10px 0 0 0;
    font-size: 1.2rem;
    opacity: 0.9;
  }
  
  .reset-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }
  
  .reset-btn:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .step-navigation {
    background: white;
    padding: 0;
    display: flex;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .step-btn {
    flex: 1;
    background: none;
    border: none;
    padding: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 500;
    color: #666;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }
  
  .step-btn:hover:not(.disabled) {
    background: #f8f9fa;
    color: #007cba;
  }
  
  .step-btn.active {
    color: #007cba;
    border-bottom-color: #007cba;
    background: #f8fbff;
  }
  
  .step-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .step-number {
    background: #007cba;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
  }
  
  .step-btn.disabled .step-number {
    background: #ccc;
  }
  
  .app-content {
    flex: 1;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    padding: 0 20px;
  }
  
  .step-content {
    margin: 30px 0;
  }
  
  .success-message {
    background: #e8f5e8;
    border: 1px solid #4caf50;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
    text-align: center;
  }
  
  .success-message h3 {
    margin: 0 0 10px 0;
    color: #2e7d32;
  }
  
  .success-message p {
    margin: 0 0 15px 0;
    color: #388e3c;
  }
  
  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .btn-primary {
    background: #007cba;
    color: white;
  }
  
  .btn-primary:hover {
    background: #005a87;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,124,186,0.3);
  }
  
  .app-footer {
    background: #2c3e50;
    color: white;
    text-align: center;
    padding: 20px;
    margin-top: 40px;
  }
  
  .app-footer a {
    color: #3498db;
    text-decoration: none;
  }
  
  .app-footer a:hover {
    text-decoration: underline;
  }
  
  @media (max-width: 768px) {
    .app-header h1 {
      font-size: 2rem;
    }
    
    .app-header p {
      font-size: 1rem;
    }
    
    .step-navigation {
      flex-direction: column;
    }
    
    .step-btn {
      padding: 15px;
    }
    
    .app-content {
      padding: 0 15px;
    }
    
    .reset-btn {
      position: static;
      margin-top: 15px;
    }
  }
</style>
