import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'sizePipe',
  standalone: true
})
export class SizePipe implements PipeTransform {
  transform(value: number): string {
    if (!value) return '0 KB';

    const kb = value / 1024;
    if (kb < 1) return value + ' Bytes';
    if (kb < 1024) return kb.toFixed(2) + ' KB';

    const mb = kb / 1024;
    return mb.toFixed(2) + ' MB';
  }
}
