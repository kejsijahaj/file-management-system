import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'filePipe',
  standalone: true
})
export class FilePipe implements PipeTransform{
  transform(value: string): string {
    if (!value) return '';
    
    switch (value) {
      case 'application/pdf':
        return 'pdf';
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return 'doc';
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return 'xls';
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      default:
        const parts = value.split('/');
        return parts[parts.length - 1] || value ;
    }
  }
}
