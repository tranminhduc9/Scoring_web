# Enterprise Clustering Analytics Platform

## Overview

This is a sophisticated web application designed for enterprise data clustering and visualization. The platform allows users to upload business data files (embeddings and company information), configure clustering parameters, and visualize results through interactive 2D scatter plots using PCA dimensionality reduction. The application features a modern React frontend with shadcn/ui components, an Express.js backend, and integrates with external clustering APIs to perform advanced machine learning analysis on enterprise datasets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **UI Library**: shadcn/ui components built on Radix UI primitives for accessibility and customization
- **Styling**: Tailwind CSS with CSS custom properties for theming and responsive design
- **State Management**: Zustand for global state management of file uploads, clustering parameters, and results
- **Data Visualization**: Plotly.js for interactive 2D scatter plots with clustering results
- **File Handling**: React Dropzone for drag-and-drop file uploads with CSV/TXT support
- **Data Processing**: Papa Parse for CSV parsing and client-side PCA computation using Web Workers

### Backend Architecture
- **Runtime**: Node.js with Express.js framework using ES modules
- **API Design**: RESTful API with clustering service proxy endpoints
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Development**: Hot module replacement with Vite middleware for seamless development experience
- **Build Process**: ESBuild for server bundling and Vite for client builds

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Connection**: Neon Database serverless PostgreSQL for cloud deployment
- **Schema Management**: Drizzle Kit for database migrations and schema synchronization
- **Session Storage**: PostgreSQL-backed session storage for user state persistence

### Authentication and Authorization
- **Session-Based**: Express sessions with secure cookie configuration
- **API Security**: Optional API key support for external clustering service integration
- **Data Validation**: Zod schemas for comprehensive input validation and type safety

### External Dependencies
- **Clustering API**: Integration with external machine learning clustering services
- **File Processing**: Support for CSV and TXT file formats with automatic delimiter detection
- **Visualization**: Plotly.js for interactive data visualization with zoom, pan, and selection tools
- **UI Components**: Comprehensive component library from shadcn/ui including forms, dialogs, and data display components