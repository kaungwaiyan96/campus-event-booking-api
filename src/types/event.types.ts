export interface CreateEventDTO {
  title: string;
  description: string;
  venueName: string;
  venueAddress: string;
  mapImageUrl?: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  capacity: number;
}

export interface UpdateEventDTO {
  title?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  mapImageUrl?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
}

export interface EventQueryFilters {
  search?: string;
  upcoming?: string;
  venue?: string;
  date?: string;
}
