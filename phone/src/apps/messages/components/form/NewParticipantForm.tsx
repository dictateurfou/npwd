import { Box, IconButton, TextField } from '@mui/material';
import React from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';

interface IState {
  numberInput: string;
  errorText: string;
  error: boolean;
}

export class NewParticipantForm extends React.Component<
  { getResult: (value: string) => void },
  IState
> {
  style: Object;
  constructor(props) {
    super(props);
    this.state = {
      numberInput: '',
      errorText: '',
      error: false,
    };
    this.handleChange = this.handleChange.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  handleChange(event: any) {
    let onlyNumbers = event.target.value.match(/[0-9]/gi, '');
    if (onlyNumbers !== null) {
      const string = onlyNumbers.join('');
      this.setState({ numberInput: string });
    } else {
      event.target.value = '';
      this.setState({ numberInput: event.target.value });
    }
    if (this.state.numberInput.length >= 3) {
      this.setState({ errorText: '', error: false });
    } else {
      this.setState({ errorText: 'Numéro invalide', error: true });
    }
  }

  onClick() {
    if (this.state.numberInput.length >= 3) {
      this.setState({ errorText: '', error: false });
      this.props.getResult(this.state.numberInput);
    } else {
      this.setState({ errorText: 'Numéro invalide', error: true });
    }
  }

  render() {
    return (
      <Box textAlign={'center'}>
        <TextField
          helperText={this.state.errorText}
          size="small"
          style={this.style}
          type="text"
          placeholder="Number"
          value={this.state.numberInput}
          onChange={this.handleChange}
          error={this.state.error}
        />
        <IconButton onClick={this.onClick} color="primary" aria-label="add to shopping cart">
          <AddBoxIcon />
        </IconButton>
      </Box>
    );
  }
}
