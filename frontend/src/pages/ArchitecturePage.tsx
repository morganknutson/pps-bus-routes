import { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { SEO } from '../components/SEO';

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'component' | 'page' | 'service' | 'hook' | 'util' | 'route' | 'backend-service' | 'backend-util';
  dependencies: string[];
  dependents: string[];
  x?: number;
  y?: number;
}

interface ApiConnection {
  from: string;
  to: string;
  endpoint: string;
  method: string;
}

// Frontend file structure with dependencies
const frontendFiles: FileNode[] = [
  // Entry Points
  { id: 'main', name: 'main.tsx', path: 'frontend/src/main.tsx', type: 'util', dependencies: ['App'], dependents: [] },
  { id: 'App', name: 'App.tsx', path: 'frontend/src/App.tsx', type: 'page', dependencies: [
    'RouteList', 'MapView', 'AddressInput', 'AddressLookup', 'SchoolList', 'TabBar', 'Header', 'Sidebar',
    'DarkModeTileLayer', 'useStore', 'SchoolsList', 'Neighborhoods', 'TechPage', 'VerificationPage',
    'JobsPage', 'HomePage', 'ServersPage', 'AdminPasswordProtection', 'loadLocalRoutes', 'schoolUtils',
    'fontAwesomeIcons', 'mapLinks', 'useMarkers', 'SchoolTypeFilters', 'ProgressBar', 'useIsMobile'
  ], dependents: ['main'] },
  
  // Pages
  { id: 'HomePage', name: 'HomePage.tsx', path: 'frontend/src/pages/HomePage.tsx', type: 'page', dependencies: [
    'useStore', 'autocompleteAddress', 'geocodeAddress', 'loadLocalRoutes', 'findClosestStop',
    'formatDistance', 'calculateDistance', 'ProgressBar'
  ], dependents: ['App'] },
  { id: 'TechPage', name: 'TechPage.tsx', path: 'frontend/src/pages/TechPage.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'ExpandableExample', 'RouteListBase', 'SchoolList'
  ], dependents: ['App'] },
  { id: 'VerificationPage', name: 'VerificationPage.tsx', path: 'frontend/src/pages/VerificationPage.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'useStore'
  ], dependents: ['App'] },
  { id: 'JobsPage', name: 'JobsPage.tsx', path: 'frontend/src/pages/JobsPage.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'JobList', 'useStore'
  ], dependents: ['App'] },
  { id: 'ServersPage', name: 'ServersPage.tsx', path: 'frontend/src/pages/ServersPage.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'useStore'
  ], dependents: ['App'] },
  { id: 'Neighborhoods', name: 'Neighborhoods.tsx', path: 'frontend/src/pages/Neighborhoods.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'useStore', 'MapView'
  ], dependents: ['App'] },
  { id: 'SchoolsList', name: 'SchoolsList.tsx', path: 'frontend/src/pages/SchoolsList.tsx', type: 'page', dependencies: [
    'Header', 'Sidebar', 'SchoolList', 'useStore'
  ], dependents: ['App'] },
  
  // Components
  { id: 'MapView', name: 'MapView.tsx', path: 'frontend/src/components/MapView.tsx', type: 'component', dependencies: [
    'useStore', 'fetchRouteForStops', 'formatStreetName', 'extractStreetNames', 'expandAddressForGeocoding',
    'createHomeIcon', 'createDefaultMarkerIcon', 'createSchoolIcon', 'createNumberedIcon', 'geocodeAddress',
    'toLeafletPosition', 'validateLngLat', 'formatCoordinates', 'DarkModeTileLayer', 'useIsMobile'
  ], dependents: ['App', 'Neighborhoods'] },
  { id: 'RouteList', name: 'RouteList.tsx', path: 'frontend/src/components/RouteList.tsx', type: 'component', dependencies: [
    'useStore', 'RouteListBase'
  ], dependents: ['App'] },
  { id: 'RouteListBase', name: 'RouteListBase.tsx', path: 'frontend/src/components/RouteListBase.tsx', type: 'component', dependencies: [
    'useStore'
  ], dependents: ['RouteList', 'TechPage'] },
  { id: 'SchoolList', name: 'SchoolList.tsx', path: 'frontend/src/components/SchoolList.tsx', type: 'component', dependencies: [
    'useStore', 'getSchoolTypes', 'getSchoolColor', 'createSchoolIcon'
  ], dependents: ['App', 'TechPage', 'SchoolsList'] },
  { id: 'AddressInput', name: 'AddressInput.tsx', path: 'frontend/src/components/AddressInput.tsx', type: 'component', dependencies: [
    'useStore', 'autocompleteAddress', 'geocodeAddress', 'useIsMobile', 'formatStreetName'
  ], dependents: ['App'] },
  { id: 'AddressLookup', name: 'AddressLookup.tsx', path: 'frontend/src/components/AddressLookup.tsx', type: 'component', dependencies: [
    'useStore', 'autocompleteAddress', 'geocodeAddress', 'useIsMobile'
  ], dependents: ['App'] },
  { id: 'Header', name: 'Header.tsx', path: 'frontend/src/components/Header.tsx', type: 'component', dependencies: [
    'ThemePicker', 'DarkModeToggle'
  ], dependents: ['App', 'TechPage', 'VerificationPage', 'JobsPage', 'ServersPage', 'Neighborhoods', 'SchoolsList'] },
  { id: 'Sidebar', name: 'Sidebar.tsx', path: 'frontend/src/components/Sidebar.tsx', type: 'component', dependencies: [], dependents: ['App', 'TechPage', 'VerificationPage', 'JobsPage', 'ServersPage', 'Neighborhoods', 'SchoolsList'] },
  { id: 'TabBar', name: 'TabBar.tsx', path: 'frontend/src/components/TabBar.tsx', type: 'component', dependencies: [], dependents: ['App'] },
  { id: 'DarkModeTileLayer', name: 'DarkModeTileLayer.tsx', path: 'frontend/src/components/DarkModeTileLayer.tsx', type: 'component', dependencies: [
    'useDarkMode'
  ], dependents: ['App', 'MapView'] },
  { id: 'ProgressBar', name: 'ProgressBar.tsx', path: 'frontend/src/components/ProgressBar.tsx', type: 'component', dependencies: [], dependents: ['App', 'HomePage'] },
  { id: 'JobList', name: 'JobList.tsx', path: 'frontend/src/components/JobList.tsx', type: 'component', dependencies: [
    'useStore'
  ], dependents: ['JobsPage'] },
  { id: 'AdminPasswordProtection', name: 'AdminPasswordProtection.tsx', path: 'frontend/src/components/AdminPasswordProtection.tsx', type: 'component', dependencies: [], dependents: ['App'] },
  { id: 'SchoolTypeFilter', name: 'SchoolTypeFilter.tsx', path: 'frontend/src/components/SchoolTypeFilter.tsx', type: 'component', dependencies: [], dependents: ['App'] },
  { id: 'ExpandableExample', name: 'ExpandableExample.tsx', path: 'frontend/src/components/ExpandableExample.tsx', type: 'component', dependencies: [], dependents: ['TechPage'] },
  
  // Services
  { id: 'api', name: 'api.ts', path: 'frontend/src/services/api.ts', type: 'service', dependencies: [], dependents: [
    'AddressInput', 'AddressLookup', 'HomePage', 'MapView', 'DriveLinkInput'
  ] },
  { id: 'loadLocalRoutes', name: 'localRoutes.ts', path: 'frontend/src/services/localRoutes.ts', type: 'service', dependencies: [
    'routeCache'
  ], dependents: ['App', 'HomePage', 'SchoolSelector'] },
  { id: 'routing', name: 'routing.ts', path: 'frontend/src/services/routing.ts', type: 'service', dependencies: [], dependents: ['MapView'] },
  { id: 'routeCache', name: 'routeCache.ts', path: 'frontend/src/services/routeCache.ts', type: 'service', dependencies: [], dependents: ['loadLocalRoutes'] },
  
  // Hooks
  { id: 'useStore', name: 'useStore.ts', path: 'frontend/src/store/useStore.ts', type: 'hook', dependencies: [], dependents: [
    'App', 'HomePage', 'MapView', 'RouteList', 'SchoolList', 'AddressInput', 'AddressLookup',
    'VerificationPage', 'JobsPage', 'ServersPage', 'Neighborhoods', 'SchoolsList', 'JobList',
    'RouteListBase', 'SchoolSelector', 'DriveLinkInput'
  ] },
  { id: 'useMarkers', name: 'useMarkers.ts', path: 'frontend/src/hooks/useMarkers.ts', type: 'hook', dependencies: [], dependents: ['App'] },
  { id: 'useIsMobile', name: 'useMediaQuery.ts', path: 'frontend/src/hooks/useMediaQuery.ts', type: 'hook', dependencies: [], dependents: ['App', 'MapView', 'AddressInput', 'AddressLookup'] },
  { id: 'useDarkMode', name: 'useDarkMode.ts', path: 'frontend/src/hooks/useDarkMode.ts', type: 'hook', dependencies: [], dependents: ['DarkModeTileLayer'] },
  
  // Utils
  { id: 'schoolUtils', name: 'schoolUtils.ts', path: 'frontend/src/utils/schoolUtils.ts', type: 'util', dependencies: [], dependents: ['App', 'SchoolList'] },
  { id: 'fontAwesomeIcons', name: 'fontAwesomeIcons.ts', path: 'frontend/src/utils/fontAwesomeIcons.ts', type: 'util', dependencies: [], dependents: ['App', 'MapView'] },
  { id: 'markerIcons', name: 'markerIcons.ts', path: 'frontend/src/utils/markerIcons.ts', type: 'util', dependencies: [], dependents: ['MapView'] },
  { id: 'mapLinks', name: 'mapLinks.ts', path: 'frontend/src/utils/mapLinks.ts', type: 'util', dependencies: [], dependents: ['App'] },
  { id: 'formatAddress', name: 'formatAddress.ts', path: 'frontend/src/utils/formatAddress.ts', type: 'util', dependencies: [], dependents: ['MapView', 'AddressInput'] },
  { id: 'coordinates', name: 'coordinates.ts', path: 'frontend/src/utils/coordinates.ts', type: 'util', dependencies: [], dependents: ['MapView'] },
  { id: 'findClosestStop', name: 'findClosestStop.ts', path: 'frontend/src/utils/findClosestStop.ts', type: 'util', dependencies: [
    'calculateDistance'
  ], dependents: ['HomePage'] },
  { id: 'distance', name: 'distance.ts', path: 'frontend/src/utils/distance.ts', type: 'util', dependencies: [], dependents: ['HomePage', 'findClosestStop'] },
  { id: 'calculateDistance', name: 'distance.ts (calculateDistance)', path: 'frontend/src/utils/distance.ts', type: 'util', dependencies: [], dependents: ['HomePage', 'findClosestStop'] },
  { id: 'SchoolSelector', name: 'SchoolSelector.tsx', path: 'frontend/src/components/SchoolSelector.tsx', type: 'component', dependencies: [
    'useStore', 'loadLocalRoutes'
  ], dependents: [] },
  { id: 'DriveLinkInput', name: 'DriveLinkInput.tsx', path: 'frontend/src/components/DriveLinkInput.tsx', type: 'component', dependencies: [
    'useStore', 'parseFolder', 'batchGeocode'
  ], dependents: [] },
];

// Backend file structure with dependencies
const backendFiles: FileNode[] = [
  // Entry Point
  { id: 'server', name: 'server.js', path: 'backend/server.js', type: 'route', dependencies: [
    'driveRouter', 'geocodeRouter', 'dataRouter', 'schedulerRouter', 'schoolsRouter', 'routesRouter',
    'streetsRouter', 'neighborhoodsRouter', 'verificationRouter', 'pdfStatusRouter', 'pdfSyncRouter',
    'processPdfsRouter', 'jobsRouter', 'pdfsRouter', 'serversRouter', 'workerService'
  ], dependents: [] },
  
  // Routes
  { id: 'driveRouter', name: 'drive.js', path: 'backend/routes/drive.js', type: 'route', dependencies: [
    'pdfParser', 'driveService'
  ], dependents: ['server'] },
  { id: 'geocodeRouter', name: 'geocode.js', path: 'backend/routes/geocode.js', type: 'route', dependencies: [
    'geocodingService'
  ], dependents: ['server'] },
  { id: 'dataRouter', name: 'data.js', path: 'backend/routes/data.js', type: 'route', dependencies: [], dependents: ['server'] },
  { id: 'schedulerRouter', name: 'scheduler.js', path: 'backend/routes/scheduler.js', type: 'route', dependencies: [
    'schedulerService'
  ], dependents: ['server'] },
  { id: 'schoolsRouter', name: 'schools.js', path: 'backend/routes/schools.js', type: 'route', dependencies: [
    'placesService'
  ], dependents: ['server'] },
  { id: 'routesRouter', name: 'routes.js', path: 'backend/routes/routes.js', type: 'route', dependencies: [], dependents: ['server'] },
  { id: 'streetsRouter', name: 'streets.js', path: 'backend/routes/streets.js', type: 'route', dependencies: [
    'streetGeometryService'
  ], dependents: ['server'] },
  { id: 'neighborhoodsRouter', name: 'neighborhoods.js', path: 'backend/routes/neighborhoods.js', type: 'route', dependencies: [
    'neighborhoodService'
  ], dependents: ['server'] },
  { id: 'verificationRouter', name: 'verification.js', path: 'backend/routes/verification.js', type: 'route', dependencies: [
    'verificationService'
  ], dependents: ['server'] },
  { id: 'pdfStatusRouter', name: 'pdfStatus.js', path: 'backend/routes/pdfStatus.js', type: 'route', dependencies: [], dependents: ['server'] },
  { id: 'pdfSyncRouter', name: 'pdfSync.js', path: 'backend/routes/pdfSync.js', type: 'route', dependencies: [
    'pdfSyncJobQueue'
  ], dependents: ['server'] },
  { id: 'processPdfsRouter', name: 'processPdfs.js', path: 'backend/routes/processPdfs.js', type: 'route', dependencies: [
    'routeProcessor'
  ], dependents: ['server'] },
  { id: 'jobsRouter', name: 'jobs.js', path: 'backend/routes/jobs.js', type: 'route', dependencies: [
    'jobQueue', 'jobHistoryService'
  ], dependents: ['server'] },
  { id: 'pdfsRouter', name: 'pdfs.js', path: 'backend/routes/pdfs.js', type: 'route', dependencies: [], dependents: ['server'] },
  { id: 'serversRouter', name: 'servers.js', path: 'backend/routes/servers.js', type: 'route', dependencies: [
    'restartService'
  ], dependents: ['server'] },
  
  // Backend Services
  { id: 'driveService', name: 'driveService.js', path: 'backend/services/driveService.js', type: 'backend-service', dependencies: [], dependents: ['driveRouter', 'schedulerService'] },
  { id: 'pdfParser', name: 'pdfParser.js', path: 'backend/services/pdfParser.js', type: 'backend-service', dependencies: [], dependents: ['driveRouter', 'routeProcessor'] },
  { id: 'geocodingService', name: 'geocodingService.js', path: 'backend/services/geocodingService.js', type: 'backend-service', dependencies: [], dependents: ['geocodeRouter', 'routeProcessor'] },
  { id: 'routeProcessor', name: 'routeProcessor.js', path: 'backend/services/routeProcessor.js', type: 'backend-service', dependencies: [
    'pdfParser', 'geocodingService', 'schoolUtils-backend'
  ], dependents: ['processPdfsRouter', 'schedulerService'] },
  { id: 'autocompleteService', name: 'autocompleteService.js', path: 'backend/services/autocompleteService.js', type: 'backend-service', dependencies: [], dependents: ['geocodeRouter'] },
  { id: 'neighborhoodService', name: 'neighborhoodService.js', path: 'backend/services/neighborhoodService.js', type: 'backend-service', dependencies: [], dependents: ['schoolsRouter', 'neighborhoodsRouter'] },
  { id: 'streetGeometryService', name: 'streetGeometryService.js', path: 'backend/services/streetGeometryService.js', type: 'backend-service', dependencies: [], dependents: ['streetsRouter'] },
  { id: 'placesService', name: 'placesService.js', path: 'backend/services/placesService.js', type: 'backend-service', dependencies: [], dependents: ['schoolsRouter'] },
  { id: 'directionsService', name: 'directionsService.js', path: 'backend/services/directionsService.js', type: 'backend-service', dependencies: [], dependents: [] },
  { id: 'schedulerService', name: 'schedulerService.js', path: 'backend/services/schedulerService.js', type: 'backend-service', dependencies: [
    'driveService', 'pdfSyncJobQueue', 'routeProcessor', 'schoolUtils-backend'
  ], dependents: ['schedulerRouter'] },
  { id: 'verificationService', name: 'verificationService.js', path: 'backend/services/verificationService.js', type: 'backend-service', dependencies: [], dependents: ['verificationRouter'] },
  { id: 'restartService', name: 'restartService.js', path: 'backend/services/restartService.js', type: 'backend-service', dependencies: [], dependents: ['serversRouter'] },
  
  // Job Queue System
  { id: 'workerService', name: 'WorkerService.js', path: 'backend/services/jobQueue/WorkerService.js', type: 'backend-service', dependencies: [
    'jobQueue', 'jobTypes'
  ], dependents: ['server'] },
  { id: 'jobQueue', name: 'JobQueue.js', path: 'backend/services/jobQueue/JobQueue.js', type: 'backend-service', dependencies: [
    'baseJobQueue', 'jobTypes'
  ], dependents: ['jobsRouter', 'workerService'] },
  { id: 'baseJobQueue', name: 'BaseJobQueue.js', path: 'backend/services/jobQueue/BaseJobQueue.js', type: 'backend-service', dependencies: [], dependents: ['jobQueue', 'pdfSyncJobQueue'] },
  { id: 'pdfSyncJobQueue', name: 'PdfSyncJobQueue.js', path: 'backend/services/jobQueue/PdfSyncJobQueue.js', type: 'backend-service', dependencies: [
    'baseJobQueue', 'jobTypes'
  ], dependents: ['pdfSyncRouter', 'schedulerService'] },
  { id: 'jobHistoryService', name: 'JobHistoryService.js', path: 'backend/services/jobQueue/JobHistoryService.js', type: 'backend-service', dependencies: [], dependents: ['jobsRouter'] },
  { id: 'jobTypes', name: 'jobTypes.js', path: 'backend/services/jobQueue/jobTypes.js', type: 'backend-service', dependencies: [], dependents: ['workerService', 'jobQueue', 'pdfSyncJobQueue'] },
  
  // Backend Utils
  { id: 'schoolUtils-backend', name: 'schoolUtils.js', path: 'backend/utils/schoolUtils.js', type: 'backend-util', dependencies: [], dependents: ['routeProcessor', 'schedulerService'] },
  { id: 'formatAddress-backend', name: 'formatAddress.js', path: 'backend/utils/formatAddress.js', type: 'backend-util', dependencies: [], dependents: [] },
];

// API Connections (Frontend -> Backend)
const apiConnections: ApiConnection[] = [
  { from: 'api', to: 'geocodeRouter', endpoint: '/api/geocode', method: 'POST' },
  { from: 'api', to: 'geocodeRouter', endpoint: '/api/geocode/autocomplete', method: 'GET' },
  { from: 'api', to: 'schoolsRouter', endpoint: '/api/schools', method: 'GET' },
  { from: 'api', to: 'schoolsRouter', endpoint: '/api/schools/:id', method: 'PUT' },
  { from: 'api', to: 'dataRouter', endpoint: '/api/data/routes', method: 'GET' },
  { from: 'api', to: 'routesRouter', endpoint: '/api/routes', method: 'GET' },
  { from: 'api', to: 'streetsRouter', endpoint: '/api/streets', method: 'GET' },
  { from: 'api', to: 'neighborhoodsRouter', endpoint: '/api/neighborhoods', method: 'GET' },
  { from: 'api', to: 'verificationRouter', endpoint: '/api/verification', method: 'GET' },
  { from: 'api', to: 'pdfStatusRouter', endpoint: '/api/pdf-status', method: 'GET' },
  { from: 'api', to: 'pdfSyncRouter', endpoint: '/api/pdf-sync', method: 'POST' },
  { from: 'api', to: 'processPdfsRouter', endpoint: '/api/process-pdfs', method: 'POST' },
  { from: 'api', to: 'jobsRouter', endpoint: '/api/jobs', method: 'GET' },
  { from: 'api', to: 'jobsRouter', endpoint: '/api/jobs/:id', method: 'GET' },
  { from: 'api', to: 'pdfsRouter', endpoint: '/api/pdfs', method: 'GET' },
  { from: 'api', to: 'serversRouter', endpoint: '/api/servers', method: 'GET' },
  { from: 'api', to: 'schedulerRouter', endpoint: '/api/scheduler', method: 'GET' },
  { from: 'api', to: 'schedulerRouter', endpoint: '/api/scheduler', method: 'POST' },
  { from: 'api', to: 'driveRouter', endpoint: '/api/drive/folder/:folderId', method: 'GET' },
  { from: 'api', to: 'driveRouter', endpoint: '/api/drive/folder/:folderId/parse', method: 'POST' },
];

// Combine all files
const allFiles = [...frontendFiles, ...backendFiles];

// Layout algorithm - hierarchical layout
function calculateLayout(files: FileNode[], showApiConnections: boolean = false): FileNode[] {
  // Create a copy of files with positions
  const filesWithPositions = files.map(f => ({ ...f, x: undefined as number | undefined, y: undefined as number | undefined }));
  const nodeMap = new Map<string, FileNode>();
  filesWithPositions.forEach(f => {
    nodeMap.set(f.id, f);
  });

  // Calculate levels (distance from entry points)
  const levels = new Map<string, number>();
  const visited = new Set<string>();
  
  // Entry points are level 0
  const entryPoints = filesWithPositions.filter(f => f.dependents.length === 0 || f.id === 'main' || f.id === 'server');
  entryPoints.forEach(f => {
    levels.set(f.id, 0);
    visited.add(f.id);
  });

  // BFS to assign levels
  const queue = [...entryPoints];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current.id) || 0;
    
    current.dependencies.forEach(depId => {
      if (!visited.has(depId)) {
        levels.set(depId, currentLevel + 1);
        visited.add(depId);
        const dep = nodeMap.get(depId);
        if (dep) {
          queue.push({ ...dep, x: dep.x ?? undefined, y: dep.y ?? undefined } as typeof filesWithPositions[0]);
        }
      } else {
        // Update level if we found a shorter path
        const existingLevel = levels.get(depId) || Infinity;
        if (currentLevel + 1 < existingLevel) {
          levels.set(depId, currentLevel + 1);
        }
      }
    });
  }
  
  // Also traverse in reverse (from dependents to dependencies) to catch nodes that depend on entry points
  const reverseQueue = [...entryPoints];
  const reverseVisited = new Set(entryPoints.map(f => f.id));
  while (reverseQueue.length > 0) {
    const current = reverseQueue.shift()!;
    const currentLevel = levels.get(current.id) || 0;
    
    // Find files that depend on this one
    filesWithPositions.forEach(f => {
      if (f.dependencies.includes(current.id) && !reverseVisited.has(f.id)) {
        reverseVisited.add(f.id);
        if (!levels.has(f.id) || levels.get(f.id)! > currentLevel + 1) {
          levels.set(f.id, currentLevel + 1);
        }
        reverseQueue.push(f);
      }
    });
  }
  
  console.log('[calculateLayout] Processed', filesWithPositions.length, 'files');
  console.log('[calculateLayout] Levels assigned:', Array.from(levels.values()).sort((a, b) => a - b));
  
  // Assign default level for unvisited nodes (cap at reasonable max)
  // First, find the actual max level from visited nodes
  let actualMaxLevel = 0;
  levels.forEach(level => {
    if (level < 1000) { // Ignore any 999 defaults that might have been set
      actualMaxLevel = Math.max(actualMaxLevel, level);
    }
  });
  
  const maxReasonableLevel = Math.min(actualMaxLevel + 5, 30); // Cap at 30 levels max
  
  filesWithPositions.forEach(f => {
    if (!levels.has(f.id)) {
      // Find max level from dependencies
      const depLevels = f.dependencies
        .map(depId => levels.get(depId))
        .filter(l => l !== undefined && l < 1000) as number[];
      
      if (depLevels.length > 0) {
        levels.set(f.id, Math.min(Math.max(...depLevels) + 1, maxReasonableLevel));
      } else {
        // No dependencies, put at a reasonable level
        levels.set(f.id, maxReasonableLevel);
      }
    }
    // Cap any level that's too high
    const currentLevel = levels.get(f.id) || 0;
    if (currentLevel > 30) {
      levels.set(f.id, 30);
    }
  });
  
  const finalMaxLevel = Math.max(...Array.from(levels.values()));
  console.log('[calculateLayout] Max level:', finalMaxLevel);

  // Group by type and level
  const grouped: { [key: string]: FileNode[] } = {};
  filesWithPositions.forEach(f => {
    const isBackend = f.path.startsWith('backend');
    const group = `${isBackend ? 'backend' : 'frontend'}-${f.type}-${levels.get(f.id)}`;
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(f);
  });

  // Position nodes
  const NODE_WIDTH = 150;
  const NODE_HEIGHT = 60;
  const HORIZONTAL_SPACING = 180;
  const VERTICAL_SPACING = 100;
  const FRONTEND_START_X = 100;
  const BACKEND_START_X = 2000;
  const START_Y = 100;

  Object.keys(grouped).sort().forEach((group, groupIndex) => {
    const nodes = grouped[group];
    const isBackend = group.startsWith('backend');
    const baseX = isBackend ? BACKEND_START_X : FRONTEND_START_X;
    const level = parseInt(group.split('-').pop() || '0');
    const y = START_Y + level * VERTICAL_SPACING;
    
    nodes.forEach((node, index) => {
      const x = baseX + (index % 5) * HORIZONTAL_SPACING;
      const row = Math.floor(index / 5);
      node.x = x;
      node.y = y + row * VERTICAL_SPACING;
    });
  });

  return filesWithPositions;
}

export function ArchitecturePage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showFrontend, setShowFrontend] = useState(true);
  const [showBackend, setShowBackend] = useState(true);
  const [showApiConnections, setShowApiConnections] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start with sidebar closed
  const [zoom, setZoom] = useState(1.5); // Start zoomed in to see nodes clearly
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const layoutedFiles = useMemo(() => {
    const filesToShow = [
      ...(showFrontend ? frontendFiles : []),
      ...(showBackend ? backendFiles : [])
    ];
    console.log('[ArchitecturePage] Files to show:', filesToShow.length, 'frontend:', showFrontend, 'backend:', showBackend);
    const result = calculateLayout(filesToShow, showApiConnections);
    const filesWithCoords = result.filter(f => f.x !== undefined && f.y !== undefined);
    console.log('[ArchitecturePage] Layouted files:', result.length, 'total,', filesWithCoords.length, 'with coordinates');
    if (filesWithCoords.length > 0) {
      console.log('[ArchitecturePage] Sample file:', filesWithCoords[0]);
      console.log('[ArchitecturePage] Coordinate range:', {
        minX: Math.min(...filesWithCoords.map(f => f.x!)),
        maxX: Math.max(...filesWithCoords.map(f => f.x!)),
        minY: Math.min(...filesWithCoords.map(f => f.y!)),
        maxY: Math.max(...filesWithCoords.map(f => f.y!))
      });
    }
    return result;
  }, [showFrontend, showBackend, showApiConnections]);

  const getFileColor = (type: FileNode['type']) => {
    switch (type) {
      case 'page': return '#4ECDC4';
      case 'component': return '#95E1D3';
      case 'service': return '#F38181';
      case 'hook': return '#AA96DA';
      case 'util': return '#FCBAD3';
      case 'route': return '#FFD93D';
      case 'backend-service': return '#6BCB77';
      case 'backend-util': return '#FF6B6B';
      default: return '#999';
    }
  };

  const getFileIcon = (type: FileNode['type']) => {
    switch (type) {
      case 'page': return '📄';
      case 'component': return '🧩';
      case 'service': return '⚙️';
      case 'hook': return '🪝';
      case 'util': return '🔧';
      case 'route': return '🛣️';
      case 'backend-service': return '🔌';
      case 'backend-util': return '🛠️';
      default: return '📁';
    }
  };

  const selectedFileNode = useMemo(() => {
    if (!selectedFile) return null;
    return allFiles.find(f => f.id === selectedFile);
  }, [selectedFile]);

  // Get all edges (dependencies)
  const edges = useMemo(() => {
    const result: Array<{ from: FileNode; to: FileNode }> = [];
    layoutedFiles.forEach(file => {
      file.dependencies.forEach(depId => {
        const dep = layoutedFiles.find(f => f.id === depId);
        if (dep && dep.x !== undefined && dep.y !== undefined && file.x !== undefined && file.y !== undefined) {
          result.push({ from: file, to: dep });
        }
      });
    });
    return result;
  }, [layoutedFiles]);

  // Get API edges
  const apiEdges = useMemo(() => {
    if (!showApiConnections) return [];
    const result: Array<{ from: FileNode; to: FileNode; conn: ApiConnection }> = [];
    apiConnections.forEach(conn => {
      const fromFile = layoutedFiles.find(f => f.id === conn.from);
      const toFile = layoutedFiles.find(f => f.id === conn.to);
      if (fromFile && toFile && fromFile.x !== undefined && fromFile.y !== undefined && 
          toFile.x !== undefined && toFile.y !== undefined) {
        result.push({ from: fromFile, to: toFile, conn });
      }
    });
    return result;
  }, [layoutedFiles, showApiConnections]);

  // Calculate bounds for viewBox
  const bounds = useMemo(() => {
    if (layoutedFiles.length === 0) {
      return { minX: 0, minY: 0, maxX: 3000, maxY: 2000 };
    }
    const filesWithCoords = layoutedFiles.filter(f => f.x !== undefined && f.y !== undefined && isFinite(f.x!) && isFinite(f.y!));
    if (filesWithCoords.length === 0) {
      console.warn('[ArchitecturePage] No files with valid coordinates');
      return { minX: 0, minY: 0, maxX: 3000, maxY: 2000 };
    }
    
    const xs = filesWithCoords.map(f => f.x!);
    const ys = filesWithCoords.map(f => f.y!);
    const minX = Math.min(...xs) - 300;
    const minY = Math.min(...ys) - 300;
    const maxX = Math.max(...xs) + 300;
    const maxY = Math.max(...ys) + 300;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    console.log('[ArchitecturePage] Bounds:', { 
      minX, minY, maxX, maxY, 
      width, height,
      filesWithCoords: filesWithCoords.length,
      totalFiles: layoutedFiles.length
    });
    
    // Ensure valid bounds
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY) || width <= 0 || height <= 0) {
      console.warn('[ArchitecturePage] Invalid bounds, using defaults');
      return { minX: 0, minY: 0, maxX: 3000, maxY: 2000 };
    }
    
    return { minX, minY, maxX, maxY };
  }, [layoutedFiles]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.05, Math.min(3, prev * delta)));
  };

  // Draw arrow helper
  const getArrowPath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6;
    const arrowX = x2 - Math.cos(angle) * 15;
    const arrowY = y2 - Math.sin(angle) * 15;
    
    const arrowPoint1X = arrowX - Math.cos(angle - arrowAngle) * arrowLength;
    const arrowPoint1Y = arrowY - Math.sin(angle - arrowAngle) * arrowLength;
    const arrowPoint2X = arrowX - Math.cos(angle + arrowAngle) * arrowLength;
    const arrowPoint2Y = arrowY - Math.sin(angle + arrowAngle) * arrowLength;
    
    return {
      linePath: `M ${x1} ${y1} L ${arrowX} ${arrowY}`,
      arrowPoints: `${x2},${y2} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <SEO 
        title="App Architecture" 
        description="Technical architecture and file structure of the PPS Bus Maps application."
      />
      <Header />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Toggle button for sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            top: '4rem',
            left: sidebarOpen ? '320px' : '0.5rem',
            zIndex: 1001,
            padding: '0.5rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 4px var(--shadow)',
            transition: 'left 0.3s ease',
          }}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
        
        <div style={{
          width: sidebarOpen ? '300px' : '0',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <Sidebar header={null} persistenceKey="sidebar-width-architecture">
            <div style={{ padding: '1rem' }}>
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '18px', color: 'var(--text-primary)' }}>
                Architecture Map
              </h2>
            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={showFrontend}
                  onChange={(e) => setShowFrontend(e.target.checked)}
                />
                Show Frontend
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={showBackend}
                  onChange={(e) => setShowBackend(e.target.checked)}
                />
                Show Backend
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '14px', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={showApiConnections}
                  onChange={(e) => setShowApiConnections(e.target.checked)}
                />
                Show API Connections
              </label>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              <div style={{ marginBottom: '0.5rem' }}>Controls:</div>
              <div style={{ marginBottom: '0.5rem' }}>• Click file to select</div>
              <div style={{ marginBottom: '0.5rem' }}>• Drag to pan</div>
              <div style={{ marginBottom: '0.5rem' }}>• Scroll to zoom</div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>📄 Page</div>
              <div style={{ marginBottom: '0.5rem' }}>🧩 Component</div>
              <div style={{ marginBottom: '0.5rem' }}>⚙️ Service</div>
              <div style={{ marginBottom: '0.5rem' }}>🪝 Hook</div>
              <div style={{ marginBottom: '0.5rem' }}>🔧 Util</div>
              <div style={{ marginBottom: '0.5rem' }}>🛣️ Route</div>
              <div style={{ marginBottom: '0.5rem' }}>🔌 Backend Service</div>
            </div>
          </div>
          </Sidebar>
        </div>

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          {layoutedFiles.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: '#000000'
            }}>
              No files to display. Please enable Frontend or Backend.
            </div>
          ) : (
            <>
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                padding: '0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: 1000,
              }}>
                Files: {layoutedFiles.filter(f => f.x !== undefined && f.y !== undefined).length} / {layoutedFiles.length}<br/>
                Bounds: {bounds.minX.toFixed(0)}, {bounds.minY.toFixed(0)} to {bounds.maxX.toFixed(0)}, {bounds.maxY.toFixed(0)}<br/>
                ViewBox: {bounds.minX} {bounds.minY} {bounds.maxX - bounds.minX} {bounds.maxY - bounds.minY}<br/>
                Zoom: {zoom.toFixed(2)}, Pan: ({pan.x.toFixed(0)}, {pan.y.toFixed(0)})
              </div>
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
                preserveAspectRatio="xMidYMid meet"
                style={{ cursor: isDragging ? 'grabbing' : 'grab', backgroundColor: '#ffffff', display: 'block' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <g transform={`translate(${pan.x / zoom}, ${pan.y / zoom}) scale(${zoom})`}>
            {/* Draw edges first (so they appear behind nodes) */}
            {edges.map((edge, index) => {
              if (edge.from.x === undefined || edge.from.y === undefined || 
                  edge.to.x === undefined || edge.to.y === undefined) return null;
              
              const isHighlighted = selectedFile === edge.from.id || selectedFile === edge.to.id;
              const color = isHighlighted ? getFileColor(edge.from.type) : '#666';
              const arrow = getArrowPath(edge.from.x!, edge.from.y!, edge.to.x!, edge.to.y!);
              const opacity = selectedFile && !isHighlighted ? 0.1 : 0.4;
              
              return (
                <g key={`edge-${edge.from.id}-${edge.to.id}-${index}`}>
                  <path
                    d={arrow.linePath}
                    stroke={color}
                    strokeWidth={1}
                    fill="none"
                    opacity={opacity}
                  />
                  <polygon
                    points={arrow.arrowPoints}
                    fill={color}
                    opacity={opacity}
                  />
                </g>
              );
            })}

            {/* Draw API edges */}
            {apiEdges.map((edge, index) => {
              if (edge.from.x === undefined || edge.from.y === undefined || 
                  edge.to.x === undefined || edge.to.y === undefined) return null;
              
              const arrow = getArrowPath(edge.from.x!, edge.from.y!, edge.to.x!, edge.to.y!);
              const opacity = selectedFile ? 0.2 : 0.5;
              
              return (
                <g key={`api-${edge.from.id}-${edge.to.id}-${index}`}>
                  <path
                    d={arrow.linePath}
                    stroke="#FF6B6B"
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray="5,5"
                    opacity={opacity}
                  />
                  <polygon
                    points={arrow.arrowPoints}
                    fill="#FF6B6B"
                    opacity={opacity}
                  />
                </g>
              );
            })}

            {/* Draw nodes */}
            {layoutedFiles.map((file) => {
              if (file.x === undefined || file.y === undefined) {
                console.warn('[ArchitecturePage] File without coordinates:', file.id, file.name);
                return null;
              }
              
              const isSelected = selectedFile === file.id;
              const color = getFileColor(file.type);
              
              return (
                <g key={file.id} transform={`translate(${file.x}, ${file.y})`}>
                  <rect
                    x="-75"
                    y="-30"
                    width="150"
                    height="60"
                    fill={isSelected ? color : '#f0f0f0'}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    rx="8"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedFile(isSelected ? null : file.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  />
                  <text
                    x="0"
                    y="-5"
                    textAnchor="middle"
                    fontSize="20"
                    fill="#000000"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {getFileIcon(file.type)}
                  </text>
                  <text
                    x="0"
                    y="15"
                    textAnchor="middle"
                    fontSize="11"
                    fill="#000000"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}
                  </text>
                </g>
              );
            })}
            
            {/* Debug: Draw a test rectangle to verify SVG is working */}
            <g>
              <rect
                x={bounds.minX + 50}
                y={bounds.minY + 50}
                width="200"
                height="100"
                fill="#ff0000"
                stroke="#000000"
                strokeWidth="2"
                opacity="0.5"
              />
              <text
                x={bounds.minX + 150}
                y={bounds.minY + 110}
                textAnchor="middle"
                fontSize="14"
                fill="#000000"
              >
                Test Rectangle
              </text>
            </g>
              </g>
            </svg>
            </>
          )}

          {/* Zoom controls */}
          {layoutedFiles.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '2rem',
              right: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              zIndex: 1000,
            }}>
              <button
                onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 4px var(--shadow)',
                }}
              >
                +
              </button>
              <button
                onClick={() => setZoom(prev => Math.max(0.05, prev * 0.8))}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 4px var(--shadow)',
                }}
              >
                −
              </button>
              <button
                onClick={() => {
                  setPan({ x: 0, y: 0 });
                  setZoom(1.5);
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  boxShadow: '0 2px 4px var(--shadow)',
                }}
              >
                Reset
              </button>
            </div>
          )}

          {/* Selected file details */}
          {selectedFileNode && (
            <div style={{
              position: 'absolute',
              top: '2rem',
              right: '2rem',
              width: '350px',
              maxHeight: '70vh',
              overflow: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              border: `2px solid ${getFileColor(selectedFileNode.type)}`,
              borderRadius: '12px',
              boxShadow: '0 4px 12px var(--shadow-large)',
              zIndex: 1000,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '24px' }}>{getFileIcon(selectedFileNode.type)}</span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>{selectedFileNode.name}</strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {selectedFileNode.path}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              {selectedFileNode.dependencies.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Dependencies ({selectedFileNode.dependencies.length})
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedFileNode.dependencies.slice(0, 10).map(dep => (
                      <div key={dep} style={{ marginBottom: '0.25rem' }}>→ {dep}</div>
                    ))}
                    {selectedFileNode.dependencies.length > 10 && (
                      <div style={{ color: 'var(--text-tertiary)' }}>... and {selectedFileNode.dependencies.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}

              {selectedFileNode.dependents.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    Dependents ({selectedFileNode.dependents.length})
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {selectedFileNode.dependents.slice(0, 10).map(dep => (
                      <div key={dep} style={{ marginBottom: '0.25rem' }}>← {dep}</div>
                    ))}
                    {selectedFileNode.dependents.length > 10 && (
                      <div style={{ color: 'var(--text-tertiary)' }}>... and {selectedFileNode.dependents.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
