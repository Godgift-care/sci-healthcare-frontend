'use client';

import { useCallback, useState } from 'react';

import { useLocaleContext } from '@/i18n/LocaleContext';
import { localIdentity, type SavedPatient } from '@/lib/beneficiary';
import { useSavedIdentity } from '@/lib/useSavedIdentity';
import { Alert, Button, Modal } from '@/components/ui';

export function SavedPatientControls({
  identifier,
  keyValue,
  onSelect,
}: {
  identifier: string;
  keyValue: string;
  onSelect: (patient: SavedPatient | null) => void;
}) {
  const { t } = useLocaleContext();
  const saved = useSavedIdentity();
  const [saveName, setSaveName] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const closeManager = useCallback(() => setManaging(false), []);
  const nickname = saveName ?? saved.selectedPatient?.nickname ?? '';

  async function selectPatient(nicknameValue: string) {
    const patient = saved.patients.find((item) => item.nickname === nicknameValue) ?? null;
    setMessage(null);
    if (!(await localIdentity.select(patient?.nickname ?? ''))) {
      setMessage(t('components.savedPatientControls.selectFailed'));
      return;
    }
    setSaveName(patient?.nickname ?? '');
    onSelect(patient);
  }

  async function savePatient() {
    setMessage(null);
    if (!nickname.trim()) {
      setMessage(t('components.savedPatientControls.nicknameRequired'));
      return;
    }
    if (!identifier.trim() || keyValue.length < 32) {
      setMessage(t('components.savedPatientControls.identifierRequired'));
      return;
    }
    if (!(await localIdentity.save(nickname, identifier, keyValue))) {
      setMessage(t('components.savedPatientControls.saveFailed'));
      return;
    }
    setSaveName(nickname.trim());
  }

  async function renamePatient(patient: SavedPatient) {
    const nextNickname = renameDraft.trim();
    setMessage(null);
    if (!nextNickname) {
      setMessage(t('components.savedPatientControls.nicknameEmpty'));
      return;
    }
    const duplicate = saved.patients.some(
      (item) =>
        item.nickname !== patient.nickname &&
        item.nickname.toLowerCase() === nextNickname.toLowerCase(),
    );
    if (duplicate) {
      setMessage(t('components.savedPatientControls.nicknameDuplicate'));
      return;
    }
    if (!(await localIdentity.rename(patient.nickname, nextNickname))) {
      setMessage(t('components.savedPatientControls.renameFailed'));
      return;
    }
    if (saved.selectedNickname === patient.nickname) {
      onSelect({ ...patient, nickname: nextNickname });
      setSaveName(nextNickname);
    }
    setEditingNickname(null);
  }

  async function deletePatient(patient: SavedPatient) {
    setMessage(null);
    if (!(await localIdentity.remove(patient.nickname))) {
      setMessage(t('components.savedPatientControls.deleteFailed'));
      return;
    }
    if (saved.selectedNickname === patient.nickname) {
      const next = localIdentity.load();
      const selected = next.patients.find((item) => item.nickname === next.selectedNickname) ?? null;
      onSelect(selected);
      setSaveName(selected?.nickname ?? '');
    }
    if (editingNickname === patient.nickname) setEditingNickname(null);
  }

  async function protectSavedPatients() {
    setMessage(null);
    if (passphrase.length < 12) {
      setMessage(t('components.savedPatientControls.passphraseTooShort'));
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setMessage(t('components.savedPatientControls.passphraseMismatch'));
      return;
    }
    if (!(await localIdentity.enableEncryption(passphrase))) {
      setMessage(t('components.savedPatientControls.protectFailed'));
      return;
    }
    setPassphrase('');
    setConfirmPassphrase('');
  }

  async function unlockSavedPatients() {
    setMessage(null);
    if (!(await localIdentity.unlock(passphrase))) {
      setMessage(t('components.savedPatientControls.unlockFailed'));
      return;
    }
    setPassphrase('');
  }

  return (
    <div className="space-y-3 border-b border-[var(--color-line)] pb-4">
      {!saved.locked && <>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="block min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            {t('components.savedPatientControls.savedPatients')}
          </span>
          <select
            aria-label={t('components.savedPatientControls.savedPatients')}
            value={saved.selectedNickname}
            onChange={(event) => selectPatient(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <option value="">{t('components.savedPatientControls.choosePatient')}</option>
            {saved.patients.map((patient) => (
              <option key={patient.nickname} value={patient.nickname}>
                {patient.nickname}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          className="self-end whitespace-nowrap"
          onClick={() => {
            setMessage(null);
            setManaging(true);
          }}
        >
          {t('components.savedPatientControls.manage')}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            {t('components.savedPatientControls.saveAs')}
          </span>
          <input
            aria-label={t('components.savedPatientControls.patientNickname')}
            value={nickname}
            onChange={(event) => setSaveName(event.target.value)}
            placeholder={t('components.savedPatientControls.nicknamePlaceholder')}
            className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
          />
        </label>
        <Button variant="ghost" className="whitespace-nowrap" onClick={savePatient}>
          {t('components.savedPatientControls.savePatient')}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
        {t('components.savedPatientControls.storageNote')}
      </p>
      </>}

      {saved.locked && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t('components.savedPatientControls.protected')}
          </p>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              {t('components.savedPatientControls.passphrase')}
            </span>
            <input
              aria-label={t('components.savedPatientControls.passphrase')}
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
            />
          </label>
          <Button onClick={unlockSavedPatients}>
            {t('components.savedPatientControls.unlock')}
          </Button>
        </div>
      )}
      {message && <Alert>{message}</Alert>}

      {!saved.locked && <Modal
        open={managing}
        onClose={closeManager}
        title={t('components.savedPatientControls.manageTitle')}
        actions={
          <Button variant="ghost" onClick={closeManager}>
            {t('components.savedPatientControls.done')}
          </Button>
        }
      >
        {saved.encrypted ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line)] pb-4">
            <p className="text-xs text-[var(--color-ink-soft)]">
              {t('components.savedPatientControls.encryptedNote')}
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                localIdentity.lock();
                onSelect(null);
                setSaveName('');
                setManaging(false);
              }}
            >
              {t('components.savedPatientControls.lock')}
            </Button>
          </div>
        ) : (
          <div className="mb-4 space-y-2 border-b border-[var(--color-line)] pb-4">
            <p className="text-sm font-medium">
              {t('components.savedPatientControls.protectTitle')}
            </p>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                {t('components.savedPatientControls.newPassphraseLabel')}
              </span>
              <input
                aria-label={t('components.savedPatientControls.newPassphrase')}
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                {t('components.savedPatientControls.confirmPassphrase')}
              </span>
              <input
                aria-label={t('components.savedPatientControls.confirmPassphrase')}
                type="password"
                autoComplete="new-password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </label>
            <Button variant="ghost" onClick={protectSavedPatients}>
              {t('components.savedPatientControls.protect')}
            </Button>
          </div>
        )}
        <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
          {t('components.savedPatientControls.hiddenNote')}
        </p>
        {saved.patients.length === 0 ? (
          <p className="py-2 text-sm text-[var(--color-ink-soft)]">
            {t('components.savedPatientControls.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {saved.patients.map((patient) => (
              <li key={patient.nickname} className="py-3">
                {editingNickname === patient.nickname ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {t('components.savedPatientControls.newNickname')}
                      </span>
                      <input
                        aria-label={t('components.savedPatientControls.newNickname')}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <Button onClick={() => renamePatient(patient)}>
                        {t('components.savedPatientControls.saveName')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setEditingNickname(null)}
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{patient.nickname}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="px-3"
                        onClick={() => {
                          setMessage(null);
                          setEditingNickname(patient.nickname);
                          setRenameDraft(patient.nickname);
                        }}
                      >
                        {t('components.savedPatientControls.rename', {
                          nickname: patient.nickname,
                        })}
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3"
                        onClick={() => deletePatient(patient)}
                      >
                        {t('components.savedPatientControls.delete', {
                          nickname: patient.nickname,
                        })}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>}
    </div>
  );
}
