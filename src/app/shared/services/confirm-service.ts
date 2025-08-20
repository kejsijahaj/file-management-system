import { Injectable, inject } from "@angular/core";
import { MatDialog} from '@angular/material/dialog';
import { firstValueFrom } from "rxjs";
import { ConfirmDeleteFolderData, ConfirmDeleteFolderDialog } from "./confirm-delete-folder-dialog";

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
}