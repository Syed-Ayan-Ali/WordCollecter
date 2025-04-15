// Global variable to cache the OAuth token within the extension session
let cachedToken = null;

// Create a context menu item that shows up when a user selects text.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addWord",
    title: "Add word to Doc",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addWord") {
    let word = info.selectionText.trim();
    if (!word) {
      console.error("No word selected.");
      return;
    }
    try {
      let definition = await fetchDefinition(word);
      let imageUrl = await fetchImage(word);
      await appendToGoogleDoc(word, definition, imageUrl);
      showNotification("Word Added", `${word} added to your document.`);
    } catch (error) {
      console.error("Error processing word:", error);
      showNotification("Error", "There was an error processing your request.");
    }
  }
});

// Helper function to retrieve and cache the OAuth token for the session.
async function getCachedAuthToken() {
  return new Promise((resolve, reject) => {
    // If we already have a token, resolve immediately.
    if (cachedToken) {
      resolve(cachedToken);
    } else {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          console.error(chrome.runtime.lastError);
          reject("Authentication failed");
        } else {
          cachedToken = token;
          resolve(cachedToken);
        }
      });
    }
  });
}

// Fetch word definition from Dictionary API
async function fetchDefinition(word) {
  let response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!response.ok) {
    throw new Error("Error fetching definition");
  }
  let data = await response.json();
  try {
    // Extract the first found definition
    let definition = data[0].meanings[0].definitions[0].definition;
    return definition;
  } catch (err) {
    return "Definition not found.";
  }
}

// Fetch an image URL from Unsplash API
async function fetchImage(word) {
  const accessKey = "FywnZrVf_ph-W0HAycpZNVr8pMVM3wfzqv4fKfzpONY";
  let response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(word)}&client_id=${accessKey}`);
  if (!response.ok) {
    throw new Error("Error fetching image");
  }
  let data = await response.json();
  try {
    // Return the small sized image URL for the first result
    let imageUrl = data.results[0].urls.small;
    return imageUrl;
  } catch (err) {
    return "";
  }
}

// Append word data to a Google Doc using the Google Docs API
async function appendToGoogleDoc(word, definition, imageUrl) {
  // Replace with your actual Google Doc ID
  const documentId = "1e2QTW0jtb2F4SafOg3rAB1jDzDc6m2dma_6g4xVj7xk";

  // Get the cached token or request a new one if needed.
  const token = await getCachedAuthToken();

  // Build the batchUpdate request payload for Google Docs.
  // Currently, we insert text at index 1. Adjust location as needed.
  let requests = [
    {
      insertText: {
        location: {
          index: 1
        },
        text: `Word: ${word} | Definition: ${definition} | Image URL: ${imageUrl}\n\n`
      }
    }
  ];

  let requestPayload = { requests };

  try {
    let response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify(requestPayload)
    });
    if (!response.ok) {
      let errorText = await response.text();
      throw new Error(errorText);
    }
    let result = await response.json();
    return result;
  } catch (err) {
    console.error("Error appending to Google Doc", err);
    throw err;
  }
}

// Display a notification via the Chrome Notifications API
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: title,
    message: message
  });
}