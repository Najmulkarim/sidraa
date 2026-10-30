'use client';

/**
 * Prints the page. With `back`, the invoice tab then closes and you are on the
 * page that opened it; a tab the browser will not close goes to `back` instead.
 * Browsers report the end of printing the same way for Print and Cancel.
 */
export function PrintButton({ back }: { back?: string }) {
  function print() {
    if (back) {
      window.addEventListener('afterprint', () => {
        window.close();
        setTimeout(() => window.location.assign(back), 300);
      }, { once: true });
    }
    window.print();
  }
  return (
    <button type="button" onClick={print} className="btn btn-primary btn-sm">
      Print
    </button>
  );
}
