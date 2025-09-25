export type Role = 'user' | 'admin';

export type Permission = 
| 'upload'
| 'rename'
| 'move'
| 'read'
| 'delete';

export interface User {
    id: string;
    username: string;
    email: string;
    password?: string;
    role: Role;
    permissions?: Permission[];
    active?: boolean;
}

export type NewUser = Omit<User, 'id'>;