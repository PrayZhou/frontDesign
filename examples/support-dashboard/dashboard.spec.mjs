import { expect, test } from '@playwright/test';

const firstAccount = page => page.getByRole('button', { name: 'Northwind Logistics' });

test('lead can review the top account, advance one row and return from details by keyboard', async ({ page }) => {
  await page.goto('index.html');
  await page.getByRole('button', { name: 'Open the at-risk account list' }).press('Enter');
  await expect(firstAccount(page)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const second = page.getByRole('button', { name: 'Meridian Health' });
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Meridian Health' })).toContainText('Eli Park');
  await page.keyboard.press('Escape');
  await expect(second).toBeFocused();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('Alder Studio');
});

test('320px keeps the queue reachable and moves secondary columns into account details', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('index.html');
  await expect(firstAccount(page)).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const table = page.getByRole('table');
  // Isolate the original desktop-width assumption; save the same viewport on each side.
  const desktopRule = await page.addStyleTag({ content: 'table { min-width: 680px }' });
  expect(await overflow()).toBeGreaterThan(0);
  await page.screenshot({ path: 'qa/320-before.png' });
  await desktopRule.evaluate(style => style.remove());
  expect(await overflow()).toBe(0);
  await page.screenshot({ path: 'qa/320-after.png' });
  expect((await firstAccount(page).boundingBox()).y).toBeLessThan(1600);
  await expect(table.getByRole('columnheader', { name: 'Owner' })).toBeHidden();
  await firstAccount(page).click();
  await expect(page.getByRole('dialog')).toContainText('Dana Wu');
  await expect(page.getByRole('dialog')).toContainText('2 hours ago');
});

for (const state of ['loading', 'empty', 'error', 'success']) {
  test('queue fixture renders ' + state, async ({ page }) => {
    await page.goto('index.html?state=' + state);
    if (state === 'empty' || state === 'loading') {
      await expect(page.getByRole('status')).toContainText(state === 'empty' ? 'No accounts at risk' : 'Loading accounts');
      await expect(page.locator('tbody tr')).toHaveCount(0);
    } else {
      await expect(firstAccount(page)).toBeVisible();
      if (state === 'error') {
        await expect(page.getByRole('alert')).toContainText('last saved');
        await page.getByRole('button', { name: 'Retry' }).click();
        await expect(page.getByRole('alert')).toBeHidden();
        await expect(firstAccount(page)).toBeVisible();
      }
    }
  });
}

for (const width of [320, 1440]) {
  test('queue heading holds position across data states at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('index.html');
    const heading = page.getByRole('heading', { name: 'Risk queue' });
    const original = await heading.boundingBox();
    for (const state of ['loading', 'empty', 'error']) {
      await page.goto('index.html?state=' + state);
      const current = await heading.boundingBox();
      expect(Math.abs(current.y - original.y), state + ' moved the queue heading').toBeLessThanOrEqual(1);
      expect(current.x).toBe(original.x);
    }
  });
}
