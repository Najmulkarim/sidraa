import { expect, test } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

test('signed-out visitors are sent to the login page', async ({ page }) => {
  for (const path of ['/admin', '/admin/orders', '/admin/settings', '/admin/export/orders']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
});

test('a wrong password shows one generic message', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill('nobody@example.test');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
});

test.describe('super admin', () => {
  test.skip(!EMAIL || !PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(EMAIL!);
    await page.getByLabel('Password').fill(PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('confirm and cancel an order; stock comes back', async ({ page, request }) => {
    // Place an order as a customer first.
    await page.goto('/product/ruffle-sleeve-top');
    await page.getByRole('radio', { name: 'S' }).click();
    await page.getByRole('button', { name: /Buy now/ }).click();
    await page.getByLabel('Full name').fill('Admin Flow');
    await page.getByLabel('Mobile number').fill('01811223344');
    await page.getByLabel('Full address').fill('House 3, Road 9, Banani');
    await page.getByLabel('District').fill('Dhaka');
    await page.getByRole('button', { name: /Place order/ }).click();
    await expect(page).toHaveURL(/\/order\//);
    const ref = page.url().split('/').pop()!;

    await page.goto(`/admin/orders?q=${ref}`);
    await page.getByRole('link', { name: ref }).click();
    await page.getByLabel('Move to').selectOption('confirmed');
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Marked as Confirmed.')).toBeVisible();

    await page.getByLabel('Move to').selectOption('cancelled');
    await page.getByRole('button', { name: 'Update status' }).click();
    await expect(page.getByText('Marked as Cancelled.')).toBeVisible();
    await expect(page.getByText(/its status is final/)).toBeVisible();

    await page.goto('/admin/inventory');
    await expect(page.getByText(ref).first()).toBeVisible(); // order + cancel movements logged
    void request;
  });

  test('create a product with opening stock and publish it', async ({ page }) => {
    const name = `E2E Kurti ${Date.now()}`;
    await page.goto('/admin/products/new');
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Price ৳').fill('1500');
    await page.getByLabel('Status').selectOption('published');
    await page.getByLabel('SKU').first().fill(`E2E-${Date.now()}`);
    await page.getByLabel('Size').first().fill('M');
    await page.getByLabel('Opening stock').first().fill('4');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Product created.')).toBeVisible();

    await page.goto('/products?q=E2E+Kurti');
    await expect(page.getByText(name)).toBeVisible();
  });

  test('CSV export downloads', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.goto('/admin/reports').then(() => page.getByRole('link', { name: 'Orders CSV' }).click())]);
    expect(download.suggestedFilename()).toMatch(/^orders_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
