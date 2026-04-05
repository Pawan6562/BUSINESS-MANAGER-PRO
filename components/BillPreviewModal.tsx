import React, { useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/use-colors';

interface BillPreviewModalProps {
  visible: boolean;
  billText: string;
  businessName: string;
  onClose: () => void;
  onShare: () => void;
}

export function BillPreviewModal({
  visible,
  billText,
  businessName,
  onClose,
  onShare,
}: BillPreviewModalProps) {
  const colors = useColors();
  const [copied, setCopied] = useState(false);

  const handleCopyText = async () => {
    try {
      await Clipboard.setStringAsync(billText);
      setCopied(true);
      Alert.alert('Copied!', 'Bill text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy bill text');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
            paddingTop: 20,
          }}
        >
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: colors.foreground,
              }}
            >
              Bill Preview
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MaterialIcons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Bill Content */}
          <ScrollView
            style={{
              height: 350,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}
            contentContainerStyle={{
              paddingBottom: 16,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: colors.foreground,
                  lineHeight: 18,
                }}
              >
                {billText}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Pressable
              onPress={handleCopyText}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.surface,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              <MaterialIcons name="content-copy" size={18} color={colors.foreground} />
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                Copy Text
              </Text>
            </Pressable>

            <Pressable
              onPress={onShare}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.success,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                opacity: pressed ? 0.8 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              <MaterialIcons name="send" size={18} color="white" />
              <Text
                style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                Share / Send
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
