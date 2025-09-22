export type Role = 'user' | 'admin';

export interface User {
    id: string;
    username: string;
    email: string;
    password?: string;
    role: Role;
}

export type NewUser = Omit<User, 'id'>;