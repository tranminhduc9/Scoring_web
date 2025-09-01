// Test script to debug server startup
console.log("Starting server test...");

try {
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  
  console.log("Environment variables set:");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("PORT:", process.env.PORT);
  
  console.log("Attempting to import server...");
  import('./dist/index.js')
    .then(() => {
      console.log("Server import successful");
    })
    .catch((error) => {
      console.error("Server import failed:", error);
      process.exit(1);
    });
} catch (error) {
  console.error("Error in test script:", error);
  process.exit(1);
}
