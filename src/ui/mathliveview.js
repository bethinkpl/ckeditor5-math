import { View } from 'ckeditor5/src/ui';

export default class MathLiveView extends View {
	constructor( locale, { options, attributes } ) {
		super( locale );
		this._options = options;
		const bind = this.bindTemplate;
		this.set( 'value', '' );
		this.setTemplate( {
			tag: 'math-field',
			attributes,
			on: {
				input: [
					bind.to( () => ( this.value = this.element.getValue( 'latex-expanded' ) ) ),
					bind.to( 'input' )
				],
				mount: [
					bind.to( () => {
						this.element.setOptions( this._options );
						// A reconnected field parses its saved value before it gets the options again (it
						// keeps no function options, e.g. `colorMap`): parse the value again with them.
						this.element.setValue( this.element.getValue(), { mode: 'math', suppressChangeNotifications: true } );
					} )
				],
				'virtual-keyboard-toggle': [
					bind.to( () => {
						this.fire( 'mathlive:virtualKeyboard:toggle', this.element.virtualKeyboardState );
					} )
				]
			}
		} );
		this.on( 'input', event => {
			// This handler should stop events loop
			if ( event.path.indexOf( this ) !== event.path.lastIndexOf( this ) ) {
				event.stop();
			}
		}, { priority: 'high' } );
		this.on( 'change:value', () => {
			if ( this.value === this.element.getValue( 'latex-expanded' ) ) {
				// Don't update mathlive again - probably text was changed by mathlive
				return;
			}

			// Without `mode`, MathLive inserts in the mode at the caret: with the caret in text
			// (`\text{…}`, a `\colorbox` body) the formula would turn into text.
			this.element.setValue( this.value, { format: 'latex', mode: 'math', suppressChangeNotifications: true } );
		} );
	}
}
