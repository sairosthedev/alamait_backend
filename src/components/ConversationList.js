import React from 'react';
import { Box, Typography, List, Divider } from '@mui/material';
import ConversationItem from './ConversationItem';

const ConversationList = ({ conversations, onConversationClick, onConversationRead }) => {
  if (!conversations || conversations.length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="text.secondary">
          No conversations found
        </Typography>
      </Box>
    );
  }

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
      {conversations.map((conversation, index) => (
        <React.Fragment key={conversation.id}>
          <ConversationItem
            conversation={conversation}
            onClick={() => onConversationClick(conversation)}
            onRead={onConversationRead}
          />
          {index < conversations.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );
};

export default ConversationList; 