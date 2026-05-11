import { expect, test } from '@playwright/test'

const PW = 'верный-мастер-пароль'

// ключевой флоу целиком в браузере: создать хранилище, заметку, запереть,
// с неверным паролем не пустить, с верным — расшифровать заметку обратно
test('заметка переживает lock/unlock, неверный пароль не пускает', async ({ page }) => {
  await page.goto('/app')

  // поля хранилища без placeholder — отсекаем поле пароля из панели аккаунта
  const vaultPw = page.locator('input[type="password"]:not([placeholder])')
  await expect(vaultPw.first()).toBeVisible()
  await vaultPw.nth(0).fill(PW)
  await vaultPw.nth(1).fill(PW)
  await page.getByRole('button', { name: 'Создать' }).click()

  // создаём заметку — сохраняется автоматически, ждём индикатор
  await page.getByRole('button', { name: 'Новая' }).click()
  await page.getByPlaceholder('Заголовок').fill('e2e заметка')
  await page.getByPlaceholder('Начните писать…').fill('секрет из e2e')
  await expect(page.getByText('сохранено')).toBeVisible()

  await page.getByRole('button', { name: 'Запереть' }).click()
  await expect(page.getByText('Хранилище заперто')).toBeVisible()

  // failure-path: неверный пароль
  const unlock = page.locator('input[type="password"]:not([placeholder])')
  await unlock.fill('чужой-пароль')
  await page.getByRole('button', { name: 'Разблокировать' }).click()
  await expect(page.getByText('неверный пароль')).toBeVisible()

  // верный пароль — заметка на месте и расшифровалась
  await unlock.fill(PW)
  await page.getByRole('button', { name: 'Разблокировать' }).click()
  await expect(page.getByText('e2e заметка')).toBeVisible()
  await expect(page.getByText('секрет из e2e')).toBeVisible()
})
