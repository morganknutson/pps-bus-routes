import { School, Route, Stop, HomeAddress } from '../types';

export const exampleSchool: School = {
  id: 'west-sylvan',
  name: 'West Sylvan',
  address: '1301 SW 25th Ave, Portland, OR 97201',
  coordinates: [-122.6984, 45.5123],
  schoolPageLink: 'https://www.pps.net/westsylvan',
  driveLink: 'https://drive.google.com/drive/folders/1BC03MH02DFuUL6teeq4jkcT2THRGgzxj',
  createdAt: '2024-01-15T10:00:00.000Z',
  schoolTypes: ['Middle School'],
  routeCount: 12,
  neighborhood: 'Sylvan-Highlands',
  routesUpdatedAt: '2024-01-15T10:00:00.000Z'
};

export const exampleStop: Stop = {
  id: 'stop-1',
  address: 'SW Patton Rd & SW Montgomery Dr [NE]',
  coordinates: [-122.6784, 45.5152],
  neighborhood: 'Sylvan-Highlands',
  time: '8:36 am',
  direction: 'NE',
};

export const exampleRoute: Route = {
  id: 'route-example-1',
  name: '100',
  direction: 'Morning',
  filename: '100SYL-A_effective_082625.pdf',
  stops: [exampleStop],
  geometry: [[45.5152, -122.6784], [45.5123, -122.6984]],
  color: '#3b82f6',
  isSelected: true,
};

export const exampleHomeAddress: HomeAddress = {
  address: '123 SW Main St, Portland, OR 97204',
  coordinates: [-122.6764, 45.5182],
  neighborhood: 'Downtown'
};

export const exampleSchools: School[] = [
  exampleSchool,
  {
    id: 'lincoln',
    name: 'Lincoln High School',
    address: '1600 SW Salmon St, Portland, OR 97205',
    coordinates: [-122.6900, 45.5200],
    schoolPageLink: 'https://www.pps.net/lincoln',
    driveLink: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    schoolTypes: ['High School'],
    routeCount: 8,
    neighborhood: 'Goose Hollow'
  },
  {
    id: 'glencoe',
    name: 'Glencoe Elementary',
    address: '825 SE 51st Ave, Portland, OR 97215',
    coordinates: [-122.6094, 45.5165],
    schoolPageLink: 'https://www.pps.net/glencoe',
    driveLink: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    schoolTypes: ['Elementary School'],
    routeCount: 4,
    neighborhood: 'North Tabor'
  }
];

export const exampleRoutes: Route[] = [
  exampleRoute,
  {
    id: 'route-example-2',
    name: '101',
    direction: 'Morning',
    filename: '101SYL-A.pdf',
    stops: [
      {
        id: 'stop-2-1',
        address: 'SW 12th & SW Market',
        coordinates: [-122.6850, 45.5130],
        time: '8:40 am',
        neighborhood: 'Downtown'
      }
    ],
    geometry: [[45.5130, -122.6850], [45.5123, -122.6984]],
    color: '#4CAF50',
    isSelected: false,
  },
  {
    id: 'route-example-3',
    name: '200',
    direction: 'Afternoon',
    filename: '200SYL-P.pdf',
    stops: [
      {
        id: 'stop-3-1',
        address: 'SW 12th & SW Market',
        coordinates: [-122.6850, 45.5130],
        time: '3:45 pm',
        neighborhood: 'Downtown'
      }
    ],
    geometry: [[45.5123, -122.6984], [45.5130, -122.6850]],
    color: '#FF9800',
    isSelected: false,
  }
];

export const exampleAssignedSchools = {
  elementary: [{
    name: 'Glencoe',
    district: 'Portland Public Schools',
    type: 'Elementary',
    website: 'https://www.pps.net/glencoe'
  }],
  middle: [{
    name: 'Mt. Tabor',
    district: 'Portland Public Schools',
    type: 'Middle',
    website: 'https://www.pps.net/mttabor'
  }],
  high: [{
    name: 'Franklin',
    district: 'Portland Public Schools',
    type: 'High',
    website: 'https://www.pps.net/franklin'
  }]
};

