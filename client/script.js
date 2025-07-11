// DOM Elements
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const documentList = document.getElementById('document-list');
const chatContainer = document.getElementById('chat-container');
const messagesContainer = document.getElementById('messages-container');
const chatPlaceholder = document.getElementById('chat-placeholder');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const deepSearchToggle = document.getElementById('deep-search-toggle');

// File hash cache to avoid recalculating
const fileHashCache = new Map();

// Chat history
let chatHistory = [];

// Load documents on page load
document.addEventListener('DOMContentLoaded', loadDocuments);

// Event listeners
uploadForm.addEventListener('submit', uploadDocument);
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Functions
async function loadDocuments() {
  try {
    const response = await fetch('/api/documents');
    const documents = await response.json();
    
    if (documents.length === 0) {
      documentList.innerHTML = '<div class="document-item-placeholder">No documents uploaded yet.</div>';
      return;
    }
    
    documentList.innerHTML = '';
    
    documents.forEach(doc => {
      const docElement = document.createElement('div');
      docElement.className = 'document-item';
      
      const nameElement = document.createElement('div');
      nameElement.className = 'document-item-name';
      nameElement.textContent = doc.name;
      
      const infoElement = document.createElement('div');
      infoElement.className = 'document-item-info';
      infoElement.textContent = `${formatBytes(doc.size)} · ${new Date(doc.created_at).toLocaleString()}`;
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.style.fontSize = '0.8rem';
      deleteButton.style.padding = '0.25rem 0.5rem';
      deleteButton.style.marginTop = '0.5rem';
      deleteButton.style.backgroundColor = '#dc3545';
      
      deleteButton.onclick = () => deleteDocument(doc.id);
      
      docElement.appendChild(nameElement);
      docElement.appendChild(infoElement);
      docElement.appendChild(deleteButton);
      
      documentList.appendChild(docElement);
    });
  } catch (error) {
    console.error('Error loading documents:', error);
    documentList.innerHTML = '<div class="error">Failed to load documents</div>';
  }
}

async function uploadDocument(e) {
  e.preventDefault();
  
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.innerHTML = '<div class="error">Please select a file</div>';
    return;
  }
  
  uploadStatus.textContent = 'Calculating file hash...';
  
  try {
    // Calculate file hash
    const fileHash = await calculateFileHash(file);
    
    // Check if file already exists
    uploadStatus.textContent = 'Checking for duplicates...';
    const duplicateCheck = await checkDuplicateFile(fileHash);
    
    if (duplicateCheck.exists) {
      const docName = duplicateCheck.document.name;
      uploadStatus.innerHTML = `<div class="error">
        This file already exists as "${docName}".<br>
        Duplicate files are not allowed.
      </div>`;
      return;
    }
    
    // File is unique, proceed with upload
    uploadStatus.textContent = 'Uploading...';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('hash', fileHash);
    
    const response = await fetch('/api/documents', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      
      // Special handling for duplicates detected server-side
      if (response.status === 409 && errorData.document) {
        uploadStatus.innerHTML = `<div class="error">
          This file already exists as "${errorData.document.name}".<br>
          Duplicate files are not allowed.
        </div>`;
        return;
      }
      
      throw new Error(errorData.error || 'Upload failed');
    }
    
    const result = await response.json();
    
    uploadStatus.innerHTML = `<div style="color: green; margin-top: 0.5rem;">
      Successfully uploaded ${file.name}.<br>
      Processed ${result.chunks} chunks.
    </div>`;
    
    // Clear file input
    fileInput.value = '';
    
    // Reload document list
    loadDocuments();
  } catch (error) {
    console.error('Error uploading document:', error);
    uploadStatus.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

async function deleteDocument(id) {
  if (!confirm('Are you sure you want to delete this document?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Delete failed');
    }
    
    // Reload document list
    loadDocuments();
  } catch (error) {
    console.error('Error deleting document:', error);
    alert(`Failed to delete document: ${error.message}`);
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  if (chatPlaceholder.style.display !== 'none') {
    chatPlaceholder.style.display = 'none';
  }

  addMessage('user', message);
  messageInput.value = '';
  chatHistory.push({ role: 'user', content: message });

  const useDeepSearch = deepSearchToggle.checked;
  const thinkingMessage = useDeepSearch ? 'Performing deep search...' : 'Thinking...';
  const assistantMessageElement = addMessage('assistant', thinkingMessage);
  let currentContent = thinkingMessage;
  
  // Create a content element that will be updated with streaming tokens
  const contentElement = assistantMessageElement.querySelector('.message-content');

  const queryParams = new URLSearchParams({
    message,
    history: JSON.stringify(chatHistory.slice(0, -1)),
    deepSearch: useDeepSearch,
  });

  const eventSource = new EventSource(`/api/chat?${queryParams.toString()}`);
  
  // For storing source chunks that will come with the final event
  let sourceChunks = null;
  
  // For markdown rendering at appropriate intervals
  let markdownRenderTimer = null;
  let streamingResponse = '';

  eventSource.addEventListener('progress', (e) => {
    const progressData = JSON.parse(e.data);
    currentContent = progressData.message;
    if (contentElement) {
      contentElement.textContent = currentContent;
    }
  });
  
  eventSource.addEventListener('token', (e) => {
    const data = JSON.parse(e.data);
    streamingResponse += data.token;
    
    // Clear any pending renders
    if (markdownRenderTimer) {
      clearTimeout(markdownRenderTimer);
    }
    
    // Schedule a new render after a short delay
    // This prevents rendering on every token while still keeping it responsive
    markdownRenderTimer = setTimeout(() => {
      if (contentElement) {
        contentElement.innerHTML = marked.parse(streamingResponse);
      }
    }, 50);
  });

  eventSource.addEventListener('final', (e) => {
    const result = JSON.parse(e.data);
    sourceChunks = result.sourceChunks;
    
    // Clear any pending renders
    if (markdownRenderTimer) {
      clearTimeout(markdownRenderTimer);
    }
    
    // Ensure the content is fully rendered with markdown
    if (contentElement) {
      contentElement.innerHTML = marked.parse(streamingResponse);
    }
    
    // Add the final message to chat history
    chatHistory.push({ role: 'assistant', content: result.message.content });
    
    // Add source chunks to the message if available
    if (sourceChunks && sourceChunks.length > 0) {
      addSourceChunksToMessage(assistantMessageElement, sourceChunks);
    }
    
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    console.error('SSE Error:', e);
    
    // Clear any pending renders
    if (markdownRenderTimer) {
      clearTimeout(markdownRenderTimer);
    }
    
    const errorContent = streamingResponse 
      ? `${streamingResponse}\n\nError processing further.`
      : 'Error getting response.';

    if (contentElement) {
      contentElement.innerHTML = marked.parse(errorContent);
    }
    
    eventSource.close();
  });
}

/**
 * Creates source chunks UI element
 * @param {Array} sourceChunks - Array of source chunks to display
 * @returns {HTMLElement} - The source chunks element
 */
function createSourceChunksElement(sourceChunks) {
  if (!sourceChunks || sourceChunks.length === 0) return null;
  
  const sourcesElement = document.createElement('div');
  sourcesElement.className = 'source-chunks';
  sourcesElement.innerHTML = '<details><summary>Sources</summary></details>';
  
  const detailsElement = sourcesElement.querySelector('details');
  
  // Sort chunks by similarity
  const sortedChunks = [...sourceChunks].sort((a, b) => b.similarity - a.similarity);
  
  sortedChunks.forEach((chunk, index) => {
    const chunkElement = document.createElement('div');
    chunkElement.className = 'source-chunk';
    
    // Get document name from chunk metadata
    const docName = chunk.documentName || 'Unknown Document';
    
    chunkElement.innerHTML = `<strong>Source ${index + 1}</strong> (Similarity: ${(chunk.similarity * 100).toFixed(1)}%)<br>
      <div style="white-space: pre-wrap; font-size: 0.85rem; margin-top: 0.25rem;">${chunk.content}</div>
      <div style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Origin: ${docName}</div>`;
    
    detailsElement.appendChild(chunkElement);
  });
  
  return sourcesElement;
}

function addMessage(role, content, sourceChunks = null) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${role}-message`;
  
  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';
  
  if (role === 'assistant') {
    contentElement.innerHTML = marked.parse(content);
  } else {
    contentElement.textContent = content;
  }
  
  messageElement.appendChild(contentElement);
  
  // Add source chunks if available
  if (sourceChunks && sourceChunks.length > 0) {
    const sourcesElement = createSourceChunksElement(sourceChunks);
    if (sourcesElement) {
      messageElement.appendChild(sourcesElement);
    }
  }
  
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return messageElement;
}

/**
 * Adds source chunks to a message element
 * @param {HTMLElement} messageElement - The message element to add source chunks to
 * @param {Array} sourceChunks - Array of source chunks to display
 */
function addSourceChunksToMessage(messageElement, sourceChunks) {
  if (!sourceChunks || sourceChunks.length === 0) return;
  
  // Check if sources already exist
  const existingSourcesEl = messageElement.querySelector('.source-chunks');
  if (existingSourcesEl) return;
  
  const sourcesElement = createSourceChunksElement(sourceChunks);
  if (sourcesElement) {
    messageElement.appendChild(sourcesElement);
  }
}

// Calculate SHA-256 hash of a file
async function calculateFileHash(file) {
  // Check if hash is already calculated
  if (fileHashCache.has(file.name + file.size + file.lastModified)) {
    return fileHashCache.get(file.name + file.size + file.lastModified);
  }
  
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Cache the hash
    fileHashCache.set(file.name + file.size + file.lastModified, hashHex);
    
    return hashHex;
  } catch (error) {
    console.error('Error calculating file hash:', error);
    throw error;
  }
}

// Check if file with same hash already exists
async function checkDuplicateFile(hash) {
  try {
    const response = await fetch(`/api/documents/check/${hash}`);
    if (!response.ok) {
      throw new Error('Failed to check file hash');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error checking duplicate file:', error);
    throw error;
  }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
} 