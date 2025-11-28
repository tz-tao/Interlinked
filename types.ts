import * as d3 from 'd3';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string; // Added phone field
  company: string;
  role: string;
  location: string;
  industry: string;
  lastContacted: string; // ISO Date
  avatarUrl?: string;
  tags: string[];
  notes: string;
  linkedIds: string[]; // IDs of people connected to this person
  deletedAt?: string; // ISO Date for soft deletion
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Suggestion {
  contactId: string;
  field: keyof Contact;
  currentValue: any;
  suggestedValue: any;
  reason: string;
}

// Allow string for custom dimensions (e.g. "Alma Mater", "Seniority")
export type GraphViewMode = 'company' | 'industry' | 'tag' | 'role' | 'location' | string;

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  name: string;
  type: 'person' | 'group';
  subtype?: GraphViewMode; // To distinguish what kind of group node it is
  val: number;
  // Metadata for search
  role?: string;
  company?: string;
  industry?: string;
  tags?: string[];
  // Dimensions for layout
  width?: number;
  height?: number;
  textWidth?: number; // Exact measured width of the label

  // Simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphState {
  searchTerm: string;
  dimension: GraphViewMode;
  customDimensionInput: string;
  customMappings: Record<string, string>;
  currentClusterIndex: number;
}
