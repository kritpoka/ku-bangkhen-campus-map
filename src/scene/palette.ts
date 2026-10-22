/**
 * Scene colors. KU green is the brand anchor; everything else stays soft and
 * bright so the green landmarks and pins carry the hierarchy.
 */
export const palette = {
  sky: '#f1f5f1',
  groundOutside: '#e9eeea',
  campusPlate: '#eaf1e7',
  lawn: '#cfe5c2',
  park: '#c3dfb4',
  pitch: '#a8d394',
  track: '#d9a48a',
  water: '#a6d8e3',
  pool: '#7fcbe0',
  road: '#ffffff',
  roadOutside: '#f4f6f4',
  path: '#f6f4ee',
  dash: '#f0c75e',
  // Plain blocks recede: light, desaturated, low contrast.
  building: '#f1f2ee',
  buildingRoof: '#fafaf7',
  buildingOutside: '#eef0ec',
  // Soft ground highlight under detailed landmarks.
  landmarkPad: '#d9eedf',
  outline: '#1d4f45',

  // Landmarks
  kuGreen: '#006664',
  kuGreenLight: '#1f8a7a',
  roof: '#2f8f74',
  roofDark: '#1d6e5b',
  wall: '#fbfbf8',
  trim: '#ffffff',
  plinth: '#cfdcd4',
  glass: '#9cc9c3',
  statue: '#3c4a46',
  stone: '#c9b8a0',

  // Trees
  canopy: ['#86c36f', '#74b866', '#93cc7a', '#69ab61', '#7dbb5e'],
  trunk: '#9a7b5e',
} as const
