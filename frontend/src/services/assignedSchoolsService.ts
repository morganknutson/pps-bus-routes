import { AssignedSchools } from '../types';

export class AssignedSchoolsService {
  async fetchAssignedSchools(lat: number, lng: number): Promise<AssignedSchools | null> {
    try {
      const response = await fetch(`/api/schools/assigned?lat=${lat}&lng=${lng}`);
      if (!response.ok) throw new Error('Failed to fetch assigned schools');
      const data = await response.json();
      return data.assigned || null;
    } catch (error) {
      console.error('[AssignedSchoolsService] Error fetching assigned schools:', error);
      return null;
    }
  }
}

export const assignedSchoolsService = new AssignedSchoolsService();

