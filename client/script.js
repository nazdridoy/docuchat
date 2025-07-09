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
  
  const formData = new FormData();
  formData.append('file', file);
  
  uploadStatus.textContent = 'Uploading...';
  
  try {
    const response = await fetch('/api/documents', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json();
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

  const queryParams = new URLSearchParams({
    message,
    history: JSON.stringify(chatHistory.slice(0, -1)),
    deepSearch: useDeepSearch,
  });

  const eventSource = new EventSource(`/api/chat?${queryParams.toString()}`);

  eventSource.addEventListener('progress', (e) => {
    const progressData = JSON.parse(e.data);
    currentContent = progressData.message;
    const contentElement = assistantMessageElement.querySelector('.message-content');
    if (contentElement) {
        contentElement.textContent = currentContent;
    }
  });

  eventSource.addEventListener('final', (e) => {
    const result = JSON.parse(e.data);
    
    messagesContainer.removeChild(assistantMessageElement);
    addMessage('assistant', result.message.content, result.sourceChunks);
    chatHistory.push({ role: 'assistant', content: result.message.content });
    
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    console.error('SSE Error:', e);
    const errorContent = currentContent === thinkingMessage
      ? 'Error getting response.'
      : `${currentContent}\n\nError processing further.`;

    const contentElement = assistantMessageElement.querySelector('.message-content');
    if (contentElement) {
        contentElement.textContent = errorContent;
    }
    eventSource.close();
  });
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
    const sourcesElement = document.createElement('div');
    sourcesElement.className = 'source-chunks';
    sourcesElement.innerHTML = '<details><summary>Sources</summary></details>';
    
    const detailsElement = sourcesElement.querySelector('details');
    
    sourceChunks.forEach((chunk, index) => {
      const chunkElement = document.createElement('div');
      chunkElement.className = 'source-chunk';
      chunkElement.innerHTML = `<strong>Source ${index + 1}</strong> (Similarity: ${(chunk.similarity * 100).toFixed(1)}%)<br>
        <div style="white-space: pre-wrap; font-size: 0.85rem; margin-top: 0.25rem;">${chunk.content}</div>`;
      
      detailsElement.appendChild(chunkElement);
    });
    
    messageElement.appendChild(sourcesElement);
  }
  
  messagesContainer.appendChild(messageElement);
  
  // Scroll to bottom
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  return messageElement;
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