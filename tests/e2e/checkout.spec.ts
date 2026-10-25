import { expect, test } from '@playwright/test';

test.describe('customer journey', () => {
  test('browse → add to cart → checkout → confirmation → track', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.goto('/product/linen-oversized-shirt');
    await page.getByRole('radio', { name: 'M' }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Added to your cart')).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Linen Oversized Shirt')).toBeVisible();
    await expect(page.getByText('৳1,290').first()).toBeVisible();
    await page.getByRole('link', { name: /Checkout/ }).click();

    await page.getByLabel('Full name').fill('E2E Customer');
    await page.getByLabel('Mobile number').fill('01799887766');
    await page.getByLabel('Full address').fill('House 12, Road 5, Mirpur');
    await page.getByLabel('District').fill('Dhaka');
    await page.getByText('Outside Dhaka').click();
    await expect(page.getByRole('button', { name: /Place order · ৳1,420/ })).toBeEnabled();
    await page.getByRole('button', { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/order\/Order\d{4,}$/);
    await expect(page.getByText('Thank you, E2E!')).toBeVisible();
    const ref = (await page.locator('.font-mono').first().innerText()).trim();

    // The cart was emptied.
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();

    // Tracking needs the reference and the last 4 digits.
    await page.goto('/track');
    await page.getByLabel('Order reference').fill(ref.toLowerCase());
    await page.getByLabel('Last 4 digits of phone').fill('0000');
    await page.getByRole('button', { name: 'Track' }).click();
    await expect(page.getByText('We could not find an order')).toBeVisible();
    await page.getByLabel('Last 4 digits of phone').fill('7766');
    await page.getByRole('button', { name: 'Track' }).click();
    await expect(page.getByText('Pending', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('House 12')).toHaveCount(0); // never shows the address
  });

  test('checkout validation keeps what the customer typed', async ({ page }) => {
    await page.goto('/product/silk-feel-scarf');
    await page.getByRole('button', { name: /Buy now/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByLabel('Full name').fill('Typed Name');
    await page.getByLabel('Mobile number').fill('12345');
    await page.getByLabel('Full address').fill('Somewhere 42, Uttara');
    await page.getByLabel('District').fill('Dhaka');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page.getByText(/valid mobile number/)).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveValue('Typed Name');
    await expect(page.getByLabel('Full address')).toHaveValue('Somewhere 42, Uttara');
  });

  test('a sold-out size cannot be chosen', async ({ page }) => {
    await page.goto('/product/wrap-midi-dress');
    await expect(page.getByRole('radio', { name: 'L' })).toBeDisabled();
  });

  test('another browser opening the confirmation link sees no personal details', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/order/SD-0000-0000');
    await expect(page.getByRole('link', { name: 'Track order' })).toBeVisible();
    await expect(page.getByText('Delivering to')).toHaveCount(0);
    await ctx.close();
  });
});
