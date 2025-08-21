<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let sheetsUrl = '';
  let csvData = [];
  let loading = false;
  let error = '';
  
  async function importFromGoogleSheets() {
    if (!sheetsUrl) {
      error = 'Please enter a Google Sheets URL';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      // Convert Google Sheets URL to CSV export URL
      const csvUrl = convertToCsvUrl(sheetsUrl);
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch data from Google Sheets');
      }
      
      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      csvData = parsedData;
      dispatch('data-imported', { data: parsedData });
      
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  function convertToCsvUrl(url) {
    // Extract the spreadsheet ID from various Google Sheets URL formats
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL');
    }
    
    const spreadsheetId = match[1];
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
  }
  
  function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    
    return { headers, data };
  }
  
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target.result;
        const parsedData = parseCSV(csvText);
        csvData = parsedData;
        dispatch('data-imported', { data: parsedData });
      };
      reader.readAsText(file);
    }
  }
</script>

<div class="google-sheets-importer">
  <h2>Import Data</h2>
  
  <div class="import-section">
    <h3>From Google Sheets</h3>
    <div class="input-group">
      <input
        type="url"
        bind:value={sheetsUrl}
        placeholder="Paste Google Sheets URL here..."
        class="url-input"
      />
      <button on:click={importFromGoogleSheets} disabled={loading} class="import-btn">
        {loading ? 'Importing...' : 'Import'}
      </button>
    </div>
    
    <p class="help-text">
      Make sure your Google Sheet is published to the web or publicly viewable
    </p>
  </div>
  
  <div class="import-section">
    <h3>Or Upload CSV File</h3>
    <input
      type="file"
      accept=".csv"
      on:change={handleFileUpload}
      class="file-input"
    />
  </div>
  
  {#if error}
    <div class="error">{error}</div>
  {/if}
  
  {#if csvData.headers && csvData.data}
    <div class="preview">
      <h3>Data Preview</h3>
      <p>{csvData.data.length} rows imported</p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              {#each csvData.headers as header}
                <th>{header}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each csvData.data.slice(0, 5) as row}
              <tr>
                {#each csvData.headers as header}
                  <td>{row[header]}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {#if csvData.data.length > 5}
          <p class="more-rows">... and {csvData.data.length - 5} more rows</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .google-sheets-importer {
    padding: 20px;
    border: 2px dashed #ccc;
    border-radius: 8px;
    margin-bottom: 20px;
  }
  
  .import-section {
    margin-bottom: 30px;
  }
  
  .input-group {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .url-input {
    flex: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .import-btn, .file-input {
    padding: 10px 20px;
    background: #007cba;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }
  
  .import-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  
  .file-input {
    background: #f5f5f5;
    color: #333;
    border: 1px solid #ddd;
  }
  
  .help-text {
    font-size: 12px;
    color: #666;
    margin-top: 5px;
  }
  
  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
  }
  
  .preview {
    margin-top: 20px;
    padding: 15px;
    background: #f9f9f9;
    border-radius: 4px;
  }
  
  .table-container {
    overflow-x: auto;
    margin-top: 10px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  
  th, td {
    padding: 8px;
    text-align: left;
    border: 1px solid #ddd;
  }
  
  th {
    background: #f5f5f5;
    font-weight: bold;
  }
  
  .more-rows {
    text-align: center;
    color: #666;
    font-style: italic;
    margin-top: 10px;
  }
</style>
