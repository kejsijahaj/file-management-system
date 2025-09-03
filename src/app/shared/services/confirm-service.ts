import { Injectable, inject } from "@angular/core";
import { MatDialog} from '@angular/material/dialog';
import { firstValueFrom } from "rxjs";
import { ConfirmDeleteFolderData, ConfirmDeleteFolderDialog } from "./confirm-delete-folder-dialog";
import { ConfirmDialog, ConfirmDialogData } from "../components/confirm-dialog/confirm-dialog";

@Injectable({providedIn:'root'})
export class ConfirmService {
    private dialog = inject(MatDialog);

    async deleteNonEmptyFolder(data: ConfirmDeleteFolderData): Promise<'cascade'|'cancel'> {
        const ref = this.dialog.open(ConfirmDeleteFolderDialog, {
            width: '420px',
            data,
            disableClose: true
        });
        const res = await firstValueFrom(ref.afterClosed());
        return res === 'cascade' ? 'cascade' : 'cancel';
    }

    async confirm(title:string, message:string): Promise<boolean> {
        const ref = this.dialog.open(ConfirmDialog, {
            width: '400px',
            data: { title, message } as ConfirmDialogData,
            disableClose: true,
        });

        return !!(await firstValueFrom(ref.afterClosed()));
    }
}