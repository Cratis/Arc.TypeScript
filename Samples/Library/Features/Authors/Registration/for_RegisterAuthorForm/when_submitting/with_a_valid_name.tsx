// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useDialog } from '@cratis/arc.react/dialogs';
import { CratisComponentsProvider } from '@cratis/components';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { RegisterAuthor } from '../../RegisterAuthor.proxy';
import { RegisterAuthorForm } from '../../RegisterAuthorForm';

function Registration() {
    const [Dialog, show] = useDialog(RegisterAuthorForm);
    return <CratisComponentsProvider value={{ locale: 'en-US' }}>
        <button onClick={() => { void show(); }}>Add author</button><Dialog />
    </CratisComponentsProvider>;
}

describe('when submitting the author registration dialog with a valid name', () => {
    let execute: sinon.SinonStub;

    beforeEach(async () => {
        execute = sinon.stub(RegisterAuthor.prototype, 'execute');
        execute.resolves({ isSuccess: true, validationResults: [] } as never);
        render(<Registration />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add author' })); });
        await act(async () => { fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  Octavia Butler  ' } }); });
        await waitFor(() => (screen.getByRole('button', { name: 'Register author' }) as HTMLButtonElement).disabled.should.equal(false));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Register author' })); });
        await waitFor(() => execute.callCount.should.equal(1));
    });

    afterEach(() => { cleanup(); sinon.restore(); });

    it('should execute the generated command with an id and trimmed name', () => {
        const command = execute.firstCall.thisValue as RegisterAuthor;
        command.name.should.equal('Octavia Butler');
        String(command.id).length.should.be.greaterThan(0);
    });

    it('should close the dialog after successful execution', () => {
        (screen.queryByRole('dialog', { name: 'Register an author' }) === null).should.equal(true);
    });
});
