// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { RegisterAuthor } from '../../RegisterAuthor.proxy';
import { RegisterAuthorForm } from '../../RegisterAuthorForm';

describe('when submitting the author registration form with a valid name', () => {
    const execute = sinon.stub();
    const setValues = sinon.stub();

    beforeEach(() => {
        execute.resolves({ isSuccess: true, validationResults: [] });
        sinon.stub(RegisterAuthor, 'use').returns([
            { execute } as unknown as RegisterAuthor, setValues, sinon.stub()
        ] as unknown as ReturnType<typeof RegisterAuthor.use>);
        render(<RegisterAuthorForm />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  Octavia Butler  ' } });
        fireEvent.submit(screen.getByRole('button', { name: 'Register author' }).closest('form')!);
    });

    afterEach(() => { cleanup(); sinon.restore(); execute.reset(); setValues.reset(); });

    it('should send the trimmed name through the generated command', async () => {
        await waitFor(() => execute.calledOnce.should.be.true);
        setValues.calledOnce.should.equal(true);
        (setValues.firstCall.args[0] as { name: string }).name.should.equal('Octavia Butler');
    });

    it('should show the successful registration', async () => {
        await waitFor(() => screen.getByRole('status').textContent!.should.equal('Author registered.'));
    });
});
