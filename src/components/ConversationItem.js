import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge, Box, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';
import axios from 'axios';

const StyledPaper = styled(Paper)(({ theme, unread }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(1),
  backgroundColor: unread ? '#E3F2FD' : theme.palette.background.paper,
  transition: 'background-color 0.3s ease',
  '&:hover': {
    backgroundColor: unread ? '#BBDEFB' : theme.palette.action.hover,
  },
}));

const UnreadText = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  color: '#0D47A1', // Navy blue color
}));

const TimestampText = styled(Typography)(({ theme, unread }) => ({
  color: unread ? '#0D47A1' : theme.palette.text.secondary,
  fontSize: '0.875rem',
}));

const ConversationItem = ({ conversation, onClick, onRead }) => {
  const {
    id,
    name,
    lastMessage,
    unreadCount,
    updatedAt,
    pinned
  } = conversation;

  const hasUnread = unreadCount > 0;

  const handleClick = async () => {
    if (hasUnread) {
      try {
        // Mark conversation as read
        await axios.post(`/api/student/messages/conversation/${id}/read`);
        // Call the onRead callback to update the UI
        if (onRead) {
          onRead(id);
        }
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    }
    // Call the original onClick handler
    if (onClick) {
      onClick(conversation);
    }
  };

  return (
    <StyledPaper 
      unread={hasUnread}
      onClick={handleClick}
      elevation={pinned ? 3 : 1}
      sx={{ cursor: 'pointer' }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {hasUnread ? (
              <UnreadText variant="subtitle1">{name}</UnreadText>
            ) : (
              <Typography variant="subtitle1">{name}</Typography>
            )}
            {pinned && (
              <Typography variant="caption" color="primary">
                📌
              </Typography>
            )}
          </Box>
          
          <Box display="flex" alignItems="center" gap={1}>
            {hasUnread ? (
              <UnreadText variant="body2" noWrap>
                {lastMessage.content}
              </UnreadText>
            ) : (
              <Typography variant="body2" color="text.secondary" noWrap>
                {lastMessage.content}
              </Typography>
            )}
          </Box>
        </Box>

        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1}>
          <TimestampText unread={hasUnread}>
            {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
          </TimestampText>
          
          {hasUnread && (
            <Badge
              badgeContent={unreadCount}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  right: -3,
                  top: 3,
                },
              }}
            />
          )}
        </Box>
      </Box>
    </StyledPaper>
  );
};

export default ConversationItem; 